// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const OpenAI = require('openai'); // npm i openai
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'brain';
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let db, documentsCol, chunksCol;

async function start() {
  const mongo = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await mongo.connect();
  db = mongo.db(MONGODB_DB);
  documentsCol = db.collection('documents');
  chunksCol = db.collection('chunks');
  // indexes
  await documentsCol.createIndex({ created_at: -1 });
  await chunksCol.createIndex({ document_id: 1 });
  console.log('Connected to MongoDB');
  app.listen(PORT, () => console.log(`Server listening ${PORT}`));
}
start().catch(console.error);

/* ---------- utilities ---------- */
// very simple chunker: tries to split text into ~500-char chunks preserving words
function chunkText(text, chunkSize = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  let cur = [];
  let curLen = 0;
  for (const w of words) {
    cur.push(w);
    curLen += w.length + 1;
    if (curLen >= chunkSize) {
      chunks.push(cur.join(' '));
      cur = [];
      curLen = 0;
    }
  }
  if (cur.length) chunks.push(cur.join(' '));
  return chunks;
}

async function getEmbedding(text) {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return resp.data[0].embedding;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

/* ---------- endpoint: add data ---------- */
/*
POST /api/add
body: { text: string, url?: string, source?: string }
*/
app.post('/api/add', async (req, res) => {
  try {
    const { text = '', url = null, source = 'mobile' } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'text required' });

    const doc = {
      text,
      url,
      source,
      created_at: new Date()
    };
    const r = await documentsCol.insertOne(doc);
    const documentId = r.insertedId;

    // chunk + embed each chunk and store
    const chunks = chunkText(text, 500);
    const chunkDocs = [];
    for (const c of chunks) {
      const embedding = await getEmbedding(c);
      chunkDocs.push({
        document_id: documentId,
        text: c,
        embedding,
        created_at: new Date()
      });
    }
    if (chunkDocs.length) {
      await chunksCol.insertMany(chunkDocs);
    }

    return res.json({ ok: true, documentId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/* ---------- endpoint: semantic query + LLM synthesis ---------- */
/*
POST /api/query
body: { query: string, k?: number }
returns: { answer: string, sources: [{document_id, snippet, score}] }
*/
app.post('/api/query', async (req, res) => {
  try {
    const { query, k = 6 } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });

    // 1) embedding for query
    const qEmb = await getEmbedding(query);

    // 2) MVP retrieval: load all chunks (ok for personal brain sizes)
    // If you have many docs, replace with vector DB or MongoDB Atlas Vector Search
    const allChunks = await chunksCol.find({}).toArray();

    // 3) compute similarities
    const scored = allChunks.map(c => ({
      ...c,
      score: cosineSim(qEmb, c.embedding)
    }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, k);

    // 4) gather source summaries and create a prompt for LLM
    const contextTexts = top.map((t, i) => `SOURCE ${i+1} (doc:${t.document_id} | score:${t.score.toFixed(3)}):\n${t.text}`).join('\n\n---\n\n');

    const systemPrompt = `Eres el asistente personal de usuario. Basándote en la información proporcionada en las "SOURCES", responde en español de forma clara, compacta y con razonamiento. Menciona de dónde sacas los puntos claves (referencia a SOURCE n). Si hay contradicciones, dilo.`;

    const userPrompt = `Pregunta: ${query}\n\nContexto:\n${contextTexts}\n\nInstrucciones: sintetiza, razona, aporta pasos accionables si aplica. Indica fuentes (SOURCE n).`;

    // 5) call LLM
    const chatResp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800
    });

    const answer = chatResp.choices?.[0]?.message?.content || '';

    // 6) return answer + sources (top)
    const sources = top.map(t => ({
      document_id: t.document_id,
      snippet: t.text,
      score: t.score
    }));

    return res.json({ answer, sources });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// index.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'frontend/build')));

// MongoDB
const uri = process.env.MONGO_URI; // Definir en Render Secrets
const client = new MongoClient(uri);
let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db('virtualBrain'); // Nombre de la DB
  }
  return db;
}

// Endpoint para agregar información
app.post('/api/add', async (req, res) => {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "No se recibió texto" });

  try {
    const db = await connectDB();
    const result = await db.collection('knowledge').insertOne({ text, createdAt: new Date() });
    res.json({ message: "Dato agregado correctamente", id: result.insertedId });
  } catch (err) {
    console.error("Error en /api/add:", err);
    res.status(500).json({ error: "Error al guardar el dato" });
  }
});

// Endpoint para consultas
app.post('/api/query', async (req, res) => {
  const { question } = req.body;

  if (!question) return res.status(400).json({ error: "No se recibió consulta" });

  try {
    const db = await connectDB();
    const docs = await db.collection('knowledge')
      .find({ text: { $regex: question, $options: 'i' } })
      .toArray();

    const answer = docs.length ? docs.map(d => d.text).join("\n---\n") : "No se encontró información relevante.";

    res.json({ answer });
  } catch (err) {
    console.error("Error en /api/query:", err);
    res.status(500).json({ error: "Error al procesar la consulta" });
  }
});

// Servir frontend para cualquier otra ruta
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

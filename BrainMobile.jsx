// BrainMobile.jsx (React)
import React, { useState } from 'react';

export default function BrainMobile() {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const add = async () => {
    if (!text.trim()) return alert('Escribe algo');
    setLoading(true);
    await fetch('/api/add', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ text, url, source: 'mobile' })
    });
    setText('');
    setUrl('');
    setLoading(false);
    alert('Guardado ✔️');
  };

  const ask = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const r = await fetch('/api/query', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ query, k: 6 })
    });
    const j = await r.json();
    setAnswer(j);
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-2">Añadir al cerebro</h2>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Escribe o pega texto (tweet, enlace, nota)..."
        className="w-full p-3 rounded border mb-2"
        rows={4}
      />
      <input
        value={url}
        onChange={e=>setUrl(e.target.value)}
        placeholder="URL opcional"
        className="w-full p-2 rounded border mb-3"
      />
      <div className="flex gap-2">
        <button onClick={add} disabled={loading} className="flex-1 p-2 rounded bg-blue-600 text-white">
          Guardar
        </button>
      </div>

      <hr className="my-4" />

      <h2 className="text-xl font-semibold mb-2">Preguntar al cerebro</h2>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Haz una pregunta en lenguaje natural..."
        className="w-full p-2 rounded border mb-2"
      />
      <div className="flex gap-2">
        <button onClick={ask} disabled={loading} className="flex-1 p-2 rounded bg-green-600 text-white">
          Preguntar
        </button>
      </div>

      {loading && <p className="mt-3">Procesando…</p>}

      {answer && (
        <div className="mt-4 p-3 rounded border bg-gray-50">
          <h3 className="font-semibold">Respuesta</h3>
          <div className="mt-2 whitespace-pre-wrap">{answer.answer}</div>

          <h4 className="mt-3 font-semibold">Fuentes (snippets)</h4>
          <ul className="list-disc list-inside">
            {answer.sources.map((s,i) => (
              <li key={i} className="text-sm">
                <strong>doc:</strong> {s.document_id} — <span className="italic">{s.snippet.slice(0,120)}...</span> <span className="text-xs text-gray-500">({s.score.toFixed(3)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// API ENDPOINTS
app.post('/api/add', async (req, res) => {
  res.json({ message: 'Dato agregado' });
});

app.post('/api/query', async (req, res) => {
  res.json({ answer: 'Respuesta simulada' });
});

// SERVIR FRONTEND REACT
app.use(express.static(path.join(__dirname, 'frontend/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

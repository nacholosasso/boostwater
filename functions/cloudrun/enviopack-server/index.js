require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Lista de dominios permitidos (Agrega tu dominio personalizado si compras uno)
const allowedOrigins = [
  'https://boostwater-497012.web.app', 
  'https://boostwater-497012.firebaseapp.com', 
  'http://localhost:5000'
];

app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json());

// Read keys from environment (do NOT hardcode keys in source)
const API_KEY = (process.env.ENVIOPACK_API_KEY || '').trim();
const SECRET_KEY = (process.env.ENVIOPACK_SECRET_KEY || '').trim();

if (!API_KEY) console.warn('Warning: ENVIOPACK_API_KEY is not set');
if (!SECRET_KEY) console.warn('Warning: ENVIOPACK_SECRET_KEY is not set');

// Función para obtener el Token temporal de Enviopack
let cachedToken = null;
async function getEnviopackToken() {
  if (cachedToken) return cachedToken;
  try {
    const authResponse = await axios.post('https://api.enviopack.com/auth', {
      "api-key": API_KEY,
      "secret-key": SECRET_KEY
    });
    cachedToken = authResponse.data.token;
    // El token expira, así que lo borramos de la memoria después de unas horas
    setTimeout(() => { cachedToken = null; }, 10 * 60 * 60 * 1000);
    return cachedToken;
  } catch (error) {
    console.error("Auth error", error?.response?.data || error.message);
    throw new Error("Falló la autenticación con Enviopack");
  }
}

// Simple health
app.get('/_health', (req, res) => res.json({ ok: true }));

// Rates endpoint: frontend calls with query params `cpDestino` and `peso`
app.get('/rates', async (req, res) => {
  try {
    const { cpDestino, peso, volumen } = req.query;
    if (!cpDestino) return res.status(400).json({ error: 'cpDestino required' });

    // 1. Obtenemos el token temporal
    const token = await getEnviopackToken();

    // Endpoint real oficial de cotización de Enviopack
    const response = await axios.get('https://api.enviopack.com/cotizar/costo', {
      params: {
        codigo_postal: cpDestino,
        peso: parseFloat(peso) || 1,
        ...(volumen && { volumen }), // Si en el futuro pasás el volumen, lo enviamos a Enviopack
        access_token: token
      },
      timeout: 10000
    });

    return res.json(response.data);
  } catch (err) {
    console.error('rates error', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'failed to fetch rates', details: err?.response?.data || err.message });
  }
});

// Create shipment: called after payment confirmed
app.post('/shipments', async (req, res) => {
  try {
    const order = req.body;
    if (!order) return res.status(400).json({ error: 'order required' });

    // 1. Obtenemos el token temporal
    const token = await getEnviopackToken();

    // Endpoint oficial para crear el envío (pedidos)
    const response = await axios.post('https://api.enviopack.com/pedidos', order, {
      params: {
        access_token: token
      },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    // Return provider response (tracking id, label url, etc.)
    return res.json(response.data);
  } catch (err) {
    console.error('shipments error', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'failed to create shipment', details: err?.response?.data || err.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Enviopack proxy listening on ${port}`));

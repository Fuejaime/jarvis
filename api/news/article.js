/**
 * /api/news/article.js — Vercel Serverless Function
 *
 * POST /api/news/article
 * Body: { url: string }
 *
 * Solo hace el fetch del HTML (evita CORS desde el iPhone).
 * El parseo con Readability se hace en el browser con DOMParser.
 */

import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const response = await axios.get(url, {
      timeout: 12_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      maxContentLength: 5 * 1024 * 1024,
      // Devolver como texto directamente
      responseType: 'text',
    });

    return res.status(200).json({ html: response.data, url });
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

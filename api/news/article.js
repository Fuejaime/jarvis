/**
 * /api/news/article.js — Vercel Serverless Function
 *
 * POST /api/news/article
 * Body: { url: string }
 *
 * Descarga el artículo y extrae el contenido limpio con Mozilla Readability.
 * Devuelve: { title, byline, content, textContent, excerpt, siteName, publishedTime }
 */

import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

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
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      // Limitar el tamaño de respuesta para no agotar la función
      maxContentLength: 5 * 1024 * 1024, // 5 MB
    });

    const dom     = new JSDOM(response.data, { url });
    const reader  = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return res.status(422).json({ error: 'Could not extract article content' });
    }

    return res.status(200).json({
      title:         article.title || '',
      byline:        article.byline || '',
      content:       article.content || '',      // HTML sanitizado
      textContent:   article.textContent || '',  // texto plano
      excerpt:       article.excerpt || '',
      siteName:      article.siteName || '',
      publishedTime: article.publishedTime || null,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

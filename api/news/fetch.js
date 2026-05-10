/**
 * /api/news/fetch.js — Vercel Serverless Function
 *
 * POST /api/news/fetch
 * Body: { feeds: [{ id, name, url, category }], maxPerFeed?: number }
 *
 * Parsea RSS en el servidor (evita CORS) y devuelve artículos normalizados.
 * Puerto de rss-fetcher.js de HERALD; adaptado a ES modules + serverless.
 */

import RssParser from 'rss-parser';
import axios from 'axios';
import iconv from 'iconv-lite';

const parser = new RssParser({
  customFields: {
    item: [
      ['media:content',   'mediaContent',   { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure',       'enclosure'],
    ],
  },
  timeout: 10_000,
});

/** Detecta el encoding del feed: Content-Type > XML prolog > utf-8 */
function detectEncoding(buffer, contentType = '') {
  const ctMatch = contentType.match(/charset=([^\s;]+)/i);
  if (ctMatch) return ctMatch[1].toLowerCase();
  const prolog   = buffer.slice(0, 200).toString('latin1');
  const xmlMatch = prolog.match(/encoding=["']([^"']+)["']/i);
  if (xmlMatch) return xmlMatch[1].toLowerCase();
  return 'utf-8';
}

/** Descarga el XML y lo decodifica con el encoding correcto */
async function fetchRaw(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout:      10_000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JarvisRSS/1.0)' },
  });
  const encoding = detectEncoding(res.data, res.headers['content-type'] || '');
  return iconv.decode(Buffer.from(res.data), encoding);
}

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Normaliza un item RSS a un objeto consistente */
function normalizeItem(item, feed) {
  let image = null;
  if (item.mediaContent?.$.url)       image = item.mediaContent.$.url;
  else if (item.mediaThumbnail?.$.url) image = item.mediaThumbnail.$.url;
  else if (item.enclosure?.url)        image = item.enclosure.url;
  else if (item.itunes?.image)         image = item.itunes.image;

  return {
    id:          `${feed.id}::${item.guid || item.link || item.title || Date.now()}`,
    title:       (item.title || '').trim(),
    url:         item.link  || item.guid || '',
    image,
    date:        item.isoDate || item.pubDate || new Date().toISOString(),
    source:      feed.name,
    sourceId:    feed.id,
    category:    feed.category || 'General',
    description: stripHtml(item.contentSnippet || item.content || item.summary || '').slice(0, 300),
  };
}

async function fetchFeed(feed, maxPerFeed) {
  const xml    = await fetchRaw(feed.url);
  const result = await parser.parseString(xml);
  return (result.items || []).slice(0, maxPerFeed).map(item => normalizeItem(item, feed));
}

// ─── Handler Vercel ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { feeds = [], maxPerFeed = 15 } = req.body || {};

  if (!Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({ error: 'feeds array is required' });
  }

  const CONCURRENCY = 5;
  const articles    = [];

  for (let i = 0; i < feeds.length; i += CONCURRENCY) {
    const batch   = feeds.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(f => fetchFeed(f, maxPerFeed)));
    for (const r of settled) {
      if (r.status === 'fulfilled') articles.push(...r.value);
      // Los feeds que fallan se ignoran silenciosamente
    }
  }

  // Ordenar por fecha descendente
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  return res.status(200).json({ articles, fetchedAt: new Date().toISOString() });
}

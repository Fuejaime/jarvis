/**
 * /api/news/fetch.js — Vercel Serverless Function
 *
 * POST /api/news/fetch
 * Body: { feeds: [{ id, name, url, category }], maxPerFeed?: number }
 *
 * Parsea RSS en el servidor (evita CORS) y devuelve artículos normalizados.
 */

import RssParser from 'rss-parser';
import axios from 'axios';
import iconv from 'iconv-lite';

const parser = new RssParser({
  customFields: {
    item: [
      // media:content puede venir como array (multiple resoluciones) → keepArray:true
      ['media:content',   'mediaContent',   { keepArray: true  }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure',       'enclosure'],
      // Algunos feeds usan media:group que envuelve media:content
      ['media:group',     'mediaGroup',     { keepArray: false }],
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

/**
 * Extrae la primera URL de imagen real de un bloque HTML.
 * Maneja comillas simples, dobles y atributos data-src (lazy load).
 */
function extractImageFromHtml(html = '') {
  if (!html) return null;
  // Prioridad: src → data-src (lazy load)
  const patterns = [
    /<img[^>]+\bsrc=["']([^"'>\s]+)["']/i,
    /<img[^>]+\bdata-src=["']([^"'>\s]+)["']/i,
    /<img[^>]+\bsrc=([^\s>"']+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

/** Comprueba si una URL de imagen es válida y no es un tracker/pixel */
function isValidImage(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  // Filtrar píxeles de tracking y gifitos 1×1
  if (/[_-]1x1|pixel|tracker|beacon|stat\.|analytics|doubleclick|counter\.gif/i.test(lower)) return false;
  // Debe tener alguna extensión de imagen o parámetros propios de CDN
  // (muchas CDN no tienen extensión en la URL — no filtrar por extensión)
  return true;
}

/**
 * Extrae la mejor imagen de un item RSS usando todos los campos disponibles,
 * con fallback a la primera <img> del contenido HTML.
 */
function extractImage(item) {
  // 1. media:content (puede ser array de resoluciones)
  if (item.mediaContent) {
    const list = Array.isArray(item.mediaContent) ? item.mediaContent : [item.mediaContent];
    // Preferir las marcadas como medium="image", o las que tengan mayor ancho
    const sorted = list
      .filter(m => m?.$ && isValidImage(m.$.url))
      .sort((a, b) => {
        const wa = parseInt(a.$.width  || '0', 10);
        const wb = parseInt(b.$.width  || '0', 10);
        return wb - wa; // mayor resolución primero
      });
    if (sorted.length > 0) return sorted[0].$.url;
  }

  // 2. media:thumbnail
  if (item.mediaThumbnail?.$.url && isValidImage(item.mediaThumbnail.$.url)) {
    return item.mediaThumbnail.$.url;
  }

  // 3. media:group → media:content dentro del grupo
  if (item.mediaGroup) {
    const gc = item.mediaGroup['media:content'];
    const gcArr = Array.isArray(gc) ? gc : (gc ? [gc] : []);
    const found = gcArr.find(m => isValidImage(m?.$.url));
    if (found) return found.$.url;
  }

  // 4. enclosure (podcasts y feeds que adjuntan la imagen como enclosure)
  if (item.enclosure?.url && isValidImage(item.enclosure.url)) {
    const url = item.enclosure.url;
    if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)) return url;
  }

  // 5. itunes:image
  if (item.itunes?.image && isValidImage(item.itunes.image)) {
    return item.itunes.image;
  }

  // 6. Fallback: primera <img> del contenido HTML (content:encoded → item.content)
  const htmlSources = [item.content, item['content:encoded'], item.summary, item.description];
  for (const html of htmlSources) {
    const url = extractImageFromHtml(html);
    if (url && isValidImage(url)) return url;
  }

  return null;
}

/** Normaliza un item RSS a un objeto consistente */
function normalizeItem(item, feed) {
  return {
    id:          `${feed.id}::${item.guid || item.link || item.title || Date.now()}`,
    title:       (item.title || '').trim(),
    url:         item.link  || item.guid || '',
    image:       extractImage(item),
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
    }
  }

  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  return res.status(200).json({ articles, fetchedAt: new Date().toISOString() });
}

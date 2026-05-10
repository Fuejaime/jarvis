/**
 * /api/news/cluster.js — Vercel Serverless Function
 *
 * POST /api/news/cluster
 * Body: { articles: Article[], threshold?: number }
 *
 * Port directo del clusterer.js de HERALD.
 * Agrupa artículos por similitud de título (Jaccard) → devuelve clusters.
 */

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'en', 'con', 'por', 'para', 'que',
  'se', 'es', 'son', 'fue', 'han', 'hay', 'the', 'a', 'an',
  'in', 'of', 'to', 'for', 'and', 'or', 'is', 'are', 'was',
  'has', 'have', 'be', 'on', 'at', 'from', 'with', 'as',
]);

function tokenize(title) {
  return title
    .toLowerCase()
    .replace(/[^a-záéíóúüñàèìòùa-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function jaccard(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function cluster(articles, threshold = 0.25) {
  const clusters  = [];
  const assigned  = new Set();
  const tokenized = articles.map(a => ({ article: a, tokens: tokenize(a.title) }));

  for (let i = 0; i < tokenized.length; i++) {
    if (assigned.has(i)) continue;

    const current = tokenized[i];
    const group   = [current.article];
    assigned.add(i);

    for (let j = i + 1; j < tokenized.length; j++) {
      if (assigned.has(j)) continue;
      if (jaccard(current.tokens, tokenized[j].tokens) >= threshold) {
        group.push(tokenized[j].article);
        assigned.add(j);
      }
    }

    // Categoría dominante del grupo
    const catCounts = {};
    for (const a of group) catCounts[a.category] = (catCounts[a.category] || 0) + 1;
    const dominantCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

    clusters.push({
      id:        `cluster-${i}-${Date.now()}`,
      articles:  group,
      mainTitle: group[0].title,
      category:  dominantCategory,
      sources:   [...new Set(group.map(a => a.source))],
      date:      group[0].date,
      image:     group.find(a => a.image)?.image || null,
      summary:   null,   // se rellena bajo demanda por /api/summarize
    });
  }

  return clusters;
}

// ─── Handler Vercel ────────────────────────────────────────────────────────────

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { articles = [], threshold = 0.25 } = req.body || {};

  if (!Array.isArray(articles)) {
    return res.status(400).json({ error: 'articles array is required' });
  }

  const clusters = cluster(articles, threshold);
  return res.status(200).json({ clusters });
}

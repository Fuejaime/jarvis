/**
 * /api/summarize.js — Vercel Serverless Function
 *
 * POST /api/summarize
 * Body: {
 *   cluster: { mainTitle, category, articles: [{ source, title, description }] },
 *   provider: { id, apiKey?, baseUrl, model },
 *   type: 'cluster' | 'briefing'
 * }
 *
 * Llama al LLM cloud indicado y devuelve el resumen (JSON o texto).
 * No hace streaming — respuesta completa (resúmenes son cortos).
 *
 * Nota: providers locales (ollama, lmstudio, mlx) se llaman directamente
 * desde el frontend. Esta función es solo para providers cloud.
 */

import axios from 'axios';

const CLOUD_PROVIDERS = new Set(['openai', 'anthropic', 'groq', 'openrouter']);

function buildMessages(type, data) {
  if (type === 'briefing') {
    const { clusters = [] } = data;
    const headlines = clusters.slice(0, 10)
      .map((c, i) => `${i + 1}. [${c.category}] ${c.mainTitle} (${(c.sources || []).join(', ')})`)
      .join('\n');

    return [
      { role: 'system', content: 'Eres un analista que genera briefings matutinos concisos. Responde en español con Markdown.' },
      { role: 'user',   content: `Genera un briefing de las noticias más importantes:\n\n${headlines}\n\nIncluye: introducción de 1-2 frases, 3 historias destacadas con contexto y cierre. Máximo 300 palabras.` },
    ];
  }

  // type === 'cluster'
  const { cluster } = data;
  const articleLines = (cluster.articles || []).slice(0, 8)
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}${a.description ? ': ' + a.description.slice(0, 150) : ''}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: 'Eres un editor de noticias experto. Sintetiza múltiples artículos sobre el mismo tema en una noticia clara, objetiva y bien escrita. Responde SIEMPRE en español. Sé conciso.',
    },
    {
      role: 'user',
      content: `Artículos sobre el mismo tema (categoría: ${cluster.category}):\n\n${articleLines}\n\nGenera (formato JSON estricto):\n{"title": "titular de máximo 12 palabras", "summary": "resumen de 3-5 frases"}`,
    },
  ];
}

async function callOpenAICompat(provider, messages) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
  };

  // OpenRouter requiere cabecera extra
  if (provider.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://jarvis.app';
    headers['X-Title']      = 'Jarvis';
  }

  const res = await axios.post(
    `${provider.baseUrl}/chat/completions`,
    { model: provider.model, messages },
    { headers, timeout: 25_000 }
  );
  return res.data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(provider, messages) {
  const system  = messages.find(m => m.role === 'system');
  const userMsg = messages.filter(m => m.role !== 'system');

  const body = {
    model:      provider.model,
    max_tokens: 1024,
    messages:   userMsg,
    ...(system ? { system: system.content } : {}),
  };

  const res = await axios.post(
    `${provider.baseUrl}/messages`,
    body,
    {
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 25_000,
    }
  );
  return res.data.content?.[0]?.text || '';
}

// ─── Handler Vercel ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { provider, type = 'cluster', ...data } = req.body || {};

  if (!provider?.id || !provider?.model) {
    return res.status(400).json({ error: 'provider.id and provider.model are required' });
  }

  if (!CLOUD_PROVIDERS.has(provider.id)) {
    return res.status(400).json({ error: 'Local providers must be called directly from the client' });
  }

  const messages = buildMessages(type, data);

  try {
    let text;
    if (provider.id === 'anthropic') {
      text = await callAnthropic(provider, messages);
    } else {
      text = await callOpenAICompat(provider, messages);
    }

    // Para clusters devolvemos JSON parseado; para briefings devolvemos texto
    if (type === 'cluster') {
      try {
        const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"summary"[\s\S]*\}/);
        if (jsonMatch) return res.status(200).json(JSON.parse(jsonMatch[0]));
      } catch { /* fallback */ }
      return res.status(200).json({ title: data.cluster?.mainTitle || '', summary: text.slice(0, 500) });
    }

    return res.status(200).json({ briefing: text });
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * /api/assistant/stream.js — Vercel Serverless Function (SSE streaming)
 *
 * POST /api/assistant/stream
 * Body: {
 *   messages: [{ role, content }],
 *   provider: { id, apiKey, baseUrl, model }
 * }
 *
 * Hace streaming SSE hacia el cliente para providers cloud.
 * Providers locales (ollama, lmstudio, mlx) deben llamarse directamente
 * desde el frontend — no pasan por aquí.
 *
 * Formato SSE:
 *   data: {"delta": "texto"}\n\n      ← chunk de texto
 *   data: [DONE]\n\n                  ← fin del stream
 *   data: {"error": "mensaje"}\n\n    ← error
 */

import axios from 'axios';

const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio', 'mlx']);

// Copilot usa la misma ruta OpenAI pero con baseUrl distinta y headers extra
const OPENAI_COMPAT = new Set(['openai', 'groq', 'openrouter', 'copilot']);

function buildHeaders(provider) {
  const headers = { 'Content-Type': 'application/json' };

  if (provider.id === 'anthropic') {
    headers['x-api-key']         = provider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  if (provider.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://jarvis.app';
    headers['X-Title']      = 'Jarvis';
  }

  // GitHub Copilot requiere cabeceras adicionales para identificar el editor
  if (provider.id === 'copilot') {
    headers['Editor-Version']        = 'vscode/1.85.1';
    headers['Editor-Plugin-Version'] = 'copilot-chat/0.11.1';
    headers['Openai-Organization']   = 'github-copilot';
  }

  return headers;
}

/** Construye el body para OpenAI-compatible providers */
function buildOpenAIBody(provider, messages) {
  return {
    model:    provider.model,
    messages,
    stream:   true,
  };
}

/** Construye el body para Anthropic (separa system message y añade max_tokens) */
function buildAnthropicBody(provider, messages) {
  const system  = messages.find(m => m.role === 'system');
  const userMsg = messages.filter(m => m.role !== 'system');
  return {
    model:      provider.model,
    max_tokens: 4096,
    messages:   userMsg,
    stream:     true,
    ...(system ? { system: system.content } : {}),
  };
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseChunk(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sseDone(res) {
  res.write('data: [DONE]\n\n');
  res.end();
}

function sseError(res, msg) {
  res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  res.end();
}

// ─── Streaming handlers ────────────────────────────────────────────────────────

async function streamOpenAI(provider, messages, res) {
  const baseUrl = provider.baseUrl || resolveBaseUrl(provider.id);

  const upstream = await axios.post(
    `${baseUrl}/chat/completions`,
    buildOpenAIBody(provider, messages),
    { headers: buildHeaders(provider), responseType: 'stream', timeout: 30_000 }
  );

  let buffer = '';

  upstream.data.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // conservar línea incompleta

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json  = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) sseChunk(res, { delta });
      } catch { /* línea no parseable — ignorar */ }
    }
  });

  upstream.data.on('end',   () => sseDone(res));
  upstream.data.on('error', (err) => sseError(res, err.message));
}

async function streamAnthropic(provider, messages, res) {
  const upstream = await axios.post(
    'https://api.anthropic.com/v1/messages',
    buildAnthropicBody(provider, messages),
    { headers: buildHeaders(provider), responseType: 'stream', timeout: 30_000 }
  );

  let buffer = '';

  upstream.data.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json  = JSON.parse(trimmed.slice(6));
        const delta = json.delta?.text;
        if (delta) sseChunk(res, { delta });
      } catch { /* ignorar */ }
    }
  });

  upstream.data.on('end',   () => sseDone(res));
  upstream.data.on('error', (err) => sseError(res, err.message));
}

function resolveBaseUrl(providerId) {
  const urls = {
    openai:     'https://api.openai.com/v1',
    groq:       'https://api.groq.com/openai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    anthropic:  'https://api.anthropic.com/v1',
  };
  return urls[providerId] || '';
}

// ─── Handler Vercel ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], provider } = req.body || {};

  if (!provider?.id || !provider?.model) {
    return res.status(400).json({ error: 'provider.id and provider.model are required' });
  }

  if (LOCAL_PROVIDERS.has(provider.id)) {
    return res.status(400).json({ error: 'Local providers must be called directly from the client' });
  }

  // Configurar headers SSE
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: desactivar buffering

  res.flushHeaders?.(); // Flushar para que el cliente reciba los headers YA

  try {
    if (provider.id === 'anthropic') {
      await streamAnthropic(provider, messages, res);
    } else {
      await streamOpenAI(provider, messages, res);
    }
  } catch (err) {
    const status = err.response?.status;
    let msg = err.message;
    if (status === 401 || status === 403) msg = 'API key inválida o sin permisos.';
    if (status === 402)                   msg = 'Sin créditos en el provider. Recarga saldo o usa Groq (gratuito).';
    if (status === 429)                   msg = 'Rate limit alcanzado. Espera un momento.';
    sseError(res, msg);
  }
}

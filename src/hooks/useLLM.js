/**
 * useLLM.js — Hook para llamadas a LLMs con streaming.
 *
 * Routing:
 *   - Providers cloud (openai, anthropic, groq, openrouter):
 *     → /api/assistant/stream (SSE proxy en Vercel)
 *   - Providers locales (ollama, lmstudio, mlx):
 *     → llamada directa desde el browser (solo en la misma red)
 *
 * Devuelve:
 *   - sendMessage(messages): inicia el streaming
 *   - abort(): cancela el streaming en curso
 *   - streaming: boolean
 *   - error: string | null
 */

import { useState, useCallback, useRef } from 'react';
import { useSettingsStore, PROVIDER_CATALOG } from '../store/settingsStore.js';

const CLOUD_PROVIDERS = new Set(['openai', 'anthropic', 'groq', 'openrouter']);
const LOCAL_BASE_URLS = {
  ollama:   'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
  mlx:      'http://localhost:8080/v1',
};

function resolveBaseUrl(provider, providerCfg) {
  if (providerCfg?.baseUrl) return providerCfg.baseUrl.replace(/\/$/, '') + (provider.id === 'ollama' ? '/v1' : '/v1');
  return LOCAL_BASE_URLS[provider.id] || '';
}

export function useLLM() {
  const providers      = useSettingsStore(s => s.providers);
  const activeProvider = useSettingsStore(s => s.activeProvider);
  const systemPrompt   = useSettingsStore(s => s.systemPrompt);

  const [streaming, setStreaming] = useState(false);
  const [error,     setError]     = useState(null);
  const abortRef = useRef(null);

  /** Devuelve la configuración del provider activo o el primero habilitado */
  function getActiveProviderConfig() {
    const id = activeProvider || PROVIDER_CATALOG.find(p => providers[p.id]?.enabled)?.id;
    if (!id) return null;

    const meta = PROVIDER_CATALOG.find(p => p.id === id);
    if (!meta) return null;

    const cfg = providers[id] || {};
    return {
      id,
      model:      cfg.model || meta.defaultModel,
      apiKey:     cfg.apiKey || '',
      baseUrl:    cfg.baseUrl || meta.defaultBaseUrl || resolveBaseUrl(meta, cfg),
      local:      meta.local,
    };
  }

  /** Streaming SSE desde /api/assistant/stream (providers cloud) */
  async function streamCloud(providerCfg, messages, onChunk) {
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch('/api/assistant/stream', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages, provider: providerCfg }),
      signal:  controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec    = new TextDecoder();
    let   buf    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop(); // línea incompleta

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const raw = trimmed.slice(6);
        if (raw === '[DONE]') return;
        try {
          const json = JSON.parse(raw);
          if (json.error) throw new Error(json.error);
          if (json.delta) onChunk(json.delta);
        } catch (e) {
          if (e.message !== 'Unexpected token') throw e;
        }
      }
    }
  }

  /**
   * Llamada directa al provider local (OpenAI-compatible endpoint).
   * Solo funciona si el iPhone está en la misma red WiFi que el Mac.
   */
  async function streamLocal(providerCfg, messages, onChunk) {
    const controller = new AbortController();
    abortRef.current = controller;

    // Ollama usa /api/chat con su propio formato; LMStudio y MLX usan OpenAI compat
    const isOllama = providerCfg.id === 'ollama';
    const endpoint = isOllama
      ? `${providerCfg.baseUrl.replace('/v1', '')}/api/chat`
      : `${providerCfg.baseUrl}/chat/completions`;

    const body = isOllama
      ? { model: providerCfg.model, messages, stream: true }
      : { model: providerCfg.model, messages, stream: true };

    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    if (!res.ok) throw new Error(`Local LLM error: HTTP ${res.status}`);

    const reader = res.body.getReader();
    const dec    = new TextDecoder();
    let   buf    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (isOllama) {
          // Ollama devuelve NDJSON
          try {
            const json  = JSON.parse(trimmed);
            const delta = json.message?.content;
            if (delta) onChunk(delta);
            if (json.done) return;
          } catch { /* ignorar */ }
        } else {
          // OpenAI SSE format
          if (!trimmed.startsWith('data: ')) continue;
          const raw = trimmed.slice(6);
          if (raw === '[DONE]') return;
          try {
            const json  = JSON.parse(raw);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) onChunk(delta);
          } catch { /* ignorar */ }
        }
      }
    }
  }

  /**
   * Envía mensajes al LLM activo con streaming.
   * @param {Array} userMessages  — mensajes del usuario (sin system prompt)
   * @param {Function} onChunk    — callback(deltaText) por cada fragmento
   * @returns {Promise<string>}   — respuesta completa
   */
  const sendMessage = useCallback(async (userMessages, onChunk) => {
    setError(null);

    const providerCfg = getActiveProviderConfig();
    if (!providerCfg) {
      const msg = 'No hay provider habilitado. Configura uno en Ajustes.';
      setError(msg);
      throw new Error(msg);
    }

    // Inyectar system prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ];

    setStreaming(true);
    let fullContent = '';

    try {
      const wrappedOnChunk = (delta) => {
        fullContent += delta;
        onChunk?.(delta);
      };

      if (CLOUD_PROVIDERS.has(providerCfg.id)) {
        await streamCloud(providerCfg, messages, wrappedOnChunk);
      } else {
        await streamLocal(providerCfg, messages, wrappedOnChunk);
      }

      return fullContent;
    } catch (err) {
      if (err.name === 'AbortError') return fullContent; // abort limpio
      const msg = err.message || 'Error desconocido';
      setError(msg);
      throw err;
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, activeProvider, systemPrompt]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, abort, streaming, error, getActiveProviderConfig };
}

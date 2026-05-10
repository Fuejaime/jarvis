/**
 * settingsStore.js — Estado global persistido en localStorage.
 *
 * Contiene: proveedores IA, feeds RSS, preferencias UI.
 * Las API keys se guardan en localStorage (app personal, sin backend auth).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Catálogo de providers ─────────────────────────────────────────────────────

export const PROVIDER_CATALOG = [
  // Cloud
  {
    id: 'openai', name: 'OpenAI', local: false, needsApiKey: true, needsBaseUrl: false,
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o3-mini'],
    defaultModel: 'gpt-4.1',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic', name: 'Anthropic', local: false, needsApiKey: true, needsBaseUrl: false,
    models: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20251101', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
    defaultModel: 'claude-3-7-sonnet-20250219',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'groq', name: 'Groq', local: false, needsApiKey: true, needsBaseUrl: false,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-qwq-32b', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'openrouter', name: 'OpenRouter', local: false, needsApiKey: true, needsBaseUrl: false,
    models: [
      'anthropic/claude-3.7-sonnet', 'anthropic/claude-3.5-haiku',
      'openai/gpt-4.1', 'openai/gpt-4o',
      'google/gemini-2.5-pro', 'deepseek/deepseek-r1', 'meta-llama/llama-3.3-70b-instruct',
    ],
    defaultModel: 'anthropic/claude-3.7-sonnet',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  // Local — solo accesibles en la misma red
  {
    id: 'ollama', name: 'Ollama', local: true, needsApiKey: false, needsBaseUrl: true,
    models: ['llama3.2', 'llama3.1:8b', 'mistral', 'phi4', 'gemma3:4b', 'qwen2.5:7b', 'deepseek-r1:7b'],
    defaultModel: 'llama3.2',
    defaultBaseUrl: 'http://localhost:11434',
  },
  {
    id: 'lmstudio', name: 'LM Studio', local: true, needsApiKey: false, needsBaseUrl: true,
    models: [],
    defaultModel: 'local-model',
    defaultBaseUrl: 'http://localhost:1234',
  },
  {
    id: 'mlx', name: 'MLX (Apple Silicon)', local: true, needsApiKey: false, needsBaseUrl: true,
    models: ['mlx-community/Llama-3.2-3B-Instruct-4bit', 'mlx-community/Llama-3.1-8B-Instruct-4bit'],
    defaultModel: 'mlx-community/Llama-3.2-3B-Instruct-4bit',
    defaultBaseUrl: 'http://localhost:8080',
  },
];

// ─── Feeds RSS por defecto ─────────────────────────────────────────────────────

const DEFAULT_FEEDS = [
  { id: 'elpais', name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', category: 'General', active: true },
  { id: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'General', active: true },
  { id: 'hacker-news', name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'Tech', active: true },
  { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Tech', active: true },
];

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // ── Tema ────────────────────────────────────────────────────────────────
      theme: 'dark',
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },

      // ── Feeds RSS ───────────────────────────────────────────────────────────
      feeds: DEFAULT_FEEDS,
      setFeeds: (feeds) => set({ feeds }),
      addFeed: (feed) => set((s) => ({ feeds: [...s.feeds, { ...feed, id: Date.now().toString(), active: true }] })),
      updateFeed: (id, patch) => set((s) => ({ feeds: s.feeds.map(f => f.id === id ? { ...f, ...patch } : f) })),
      removeFeed: (id) => set((s) => ({ feeds: s.feeds.filter(f => f.id !== id) })),

      // ── Providers IA ────────────────────────────────────────────────────────
      // providers: { [id]: { enabled, apiKey, model, baseUrl } }
      providers: {},
      setProvider: (id, config) =>
        set((s) => ({ providers: { ...s.providers, [id]: { ...s.providers[id], ...config } } })),

      // Provider activo para el assistant
      activeProvider: null,
      setActiveProvider: (id) => set({ activeProvider: id }),

      // Helper: devuelve el primer provider habilitado (o null)
      getFirstEnabledProvider: () => {
        const { providers } = get();
        return PROVIDER_CATALOG.find(p => providers[p.id]?.enabled) || null;
      },

      // ── Preferencias del assistant ──────────────────────────────────────────
      systemPrompt: 'Eres Jarvis, un asistente personal experto. Responde en español. Sé directo y conciso.',
      setSystemPrompt: (p) => set({ systemPrompt: p }),

      // ── Preferencias UI ─────────────────────────────────────────────────────
      newsMaxPerFeed: 20,
      setNewsMaxPerFeed: (n) => set({ newsMaxPerFeed: n }),

      clusterThreshold: 0.25,
      setClusterThreshold: (t) => set({ clusterThreshold: t }),

      // ── Voz ─────────────────────────────────────────────────────────────────
      sttProvider: 'webspeech', // 'webspeech' | 'groq'
      setSttProvider: (p) => set({ sttProvider: p }),

      ttsEnabled: true,
      setTtsEnabled: (v) => set({ ttsEnabled: v }),

      ttsVoice: '',       // nombre de la voz (vacío = voz por defecto del sistema)
      setTtsVoice: (v) => set({ ttsVoice: v }),
    }),
    {
      name: 'jarvis-settings',
      // No persistir datos derivados que se pueden recalcular
      partialize: (s) => ({
        theme: s.theme,
        feeds: s.feeds,
        providers: s.providers,
        activeProvider: s.activeProvider,
        systemPrompt: s.systemPrompt,
        newsMaxPerFeed: s.newsMaxPerFeed,
        clusterThreshold: s.clusterThreshold,
        sttProvider: s.sttProvider,
        ttsEnabled: s.ttsEnabled,
        ttsVoice: s.ttsVoice,
      }),
    }
  )
);

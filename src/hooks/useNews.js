/**
 * useNews.js — Hook principal del módulo de noticias.
 *
 * Cache de módulo (_cache): los datos sobreviven entre montajes del componente
 * (cuando el usuario cambia de tab y vuelve). La recarga solo ocurre si el
 * TTL de 1 hora ha expirado o se fuerza con refresh().
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore.js';
import {
  saveArticles, getArticles, clearOldArticles,
  getReadState, markRead, markAllRead,
  getCachedClusters, saveClusters,
} from '../services/db.js';

const FETCH_ENDPOINT   = '/api/news/fetch';
const CLUSTER_ENDPOINT = '/api/news/cluster';
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1h

// ─── Cache de módulo: persiste entre montajes (cambios de tab) ────────────────
const LS_READ_IDS_KEY = 'news:readIds';

function _loadReadIdsFromStorage() {
  try {
    const raw = localStorage.getItem(LS_READ_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function _saveReadIdsToStorage(set) {
  try {
    localStorage.setItem(LS_READ_IDS_KEY, JSON.stringify([...set]));
  } catch {
    // storage full — ignorar
  }
}

const _cache = {
  clusters:  [],
  readIds:   _loadReadIdsFromStorage(), // init síncrono desde localStorage
  lastFetch: null,
  cacheKey:  null,
};

export function useNews() {
  const feeds            = useSettingsStore(s => s.feeds);
  const newsMaxPerFeed   = useSettingsStore(s => s.newsMaxPerFeed);
  const clusterThreshold = useSettingsStore(s => s.clusterThreshold);

  // ─── Biblioteca de noticias guardadas (en Zustand/localStorage) ──────────
  const savedClusters      = useSettingsStore(s => s.savedClusters);
  const addSavedCluster    = useSettingsStore(s => s.addSavedCluster);
  const removeSavedCluster = useSettingsStore(s => s.removeSavedCluster);
  const savedIds = useMemo(() => new Set(savedClusters.map(c => c.id)), [savedClusters]);

  // Inicializar con datos del cache de módulo para evitar flash al re-montar
  const [clusters,   setClustersState]   = useState(_cache.clusters);
  const [readIds,    setReadIdsState]     = useState(_cache.readIds);
  const [loading,    setLoading]          = useState(_cache.clusters.length === 0);
  const [refreshing, setRefreshing]       = useState(false);
  const [error,      setError]            = useState(null);
  const [lastFetch,  setLastFetchState]   = useState(_cache.lastFetch);

  const timerRef = useRef(null);

  // Wrappers que actualizan tanto el estado React como el cache de módulo
  const setClusters  = useCallback((v) => { _cache.clusters  = v; setClustersState(v);  }, []);
  // setReadIds soporta tanto valor directo como updater function
  const setReadIds   = useCallback((v) => {
    const resolved = typeof v === 'function' ? v(_cache.readIds) : v;
    _cache.readIds  = resolved;
    _saveReadIdsToStorage(resolved); // sync a localStorage para sobrevivir recargas
    setReadIdsState(resolved);
  }, []);
  const setLastFetch = useCallback((v) => { _cache.lastFetch = v; setLastFetchState(v); }, []);

  // ─── Clave de caché: hash de feeds activos + threshold ───────────────────────
  const cacheKey = feeds
    .filter(f => f.active)
    .map(f => f.id)
    .sort()
    .join(',') + `:${clusterThreshold}`;

  // ─── Read-state: si localStorage vacío, hidratar desde IndexedDB ─────────────
  useEffect(() => {
    if (_cache.readIds.size === 0) {
      getReadState().then(setReadIds);
    }
    clearOldArticles();
  }, [setReadIds]);

  // ─── Fetch principal ──────────────────────────────────────────────────────────
  const fetchNews = useCallback(async ({ force = false } = {}) => {
    const activeFeeds = feeds.filter(f => f.active);
    if (activeFeeds.length === 0) return;

    // Si el cacheKey no cambió y tenemos datos recientes, no refetchar
    const age = _cache.lastFetch ? Date.now() - _cache.lastFetch.getTime() : Infinity;
    if (!force && _cache.cacheKey === cacheKey && age < REFRESH_INTERVAL && _cache.clusters.length > 0) {
      return;
    }

    // Intentar IndexedDB primero
    if (!force) {
      const cached = await getCachedClusters(cacheKey);
      if (cached) {
        _cache.cacheKey = cacheKey;
        setClusters(cached);
        setLastFetch(new Date());
        setLoading(false);
        return;
      }
    }

    // Fetch real
    if (_cache.clusters.length === 0) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const fetchRes = await fetch(FETCH_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ feeds: activeFeeds, maxPerFeed: newsMaxPerFeed }),
      });
      if (!fetchRes.ok) throw new Error(`Feed fetch error: ${fetchRes.status}`);
      const { articles } = await fetchRes.json();

      await saveArticles(articles);

      const clusterRes = await fetch(CLUSTER_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ articles, threshold: clusterThreshold }),
      });
      if (!clusterRes.ok) throw new Error(`Cluster error: ${clusterRes.status}`);
      const { clusters: newClusters } = await clusterRes.json();

      await saveClusters(cacheKey, newClusters);
      _cache.cacheKey = cacheKey;
      setClusters(newClusters);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
      const offlineArticles = await getArticles();
      if (offlineArticles.length > 0) {
        const clusterRes = await fetch(CLUSTER_ENDPOINT, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ articles: offlineArticles, threshold: clusterThreshold }),
        }).catch(() => null);
        if (clusterRes?.ok) {
          const { clusters: offlineClusters } = await clusterRes.json();
          _cache.cacheKey = cacheKey;
          setClusters(offlineClusters);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feeds, newsMaxPerFeed, clusterThreshold, cacheKey, setClusters, setLastFetch]);

  // ─── Carga inicial + auto-refresh ─────────────────────────────────────────────
  useEffect(() => {
    fetchNews();
    timerRef.current = setInterval(() => fetchNews({ force: true }), REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchNews]);

  // ─── Marcar leído ─────────────────────────────────────────────────────────────
  const toggleRead = useCallback(async (articleId) => {
    const isRead = readIds.has(articleId);
    // Optimistic update: estado primero, IndexedDB en background
    setReadIds(prev => {
      const next = new Set(prev);
      isRead ? next.delete(articleId) : next.add(articleId);
      return next;
    });
    markRead(articleId, !isRead).catch(console.error);
  }, [readIds, setReadIds]);

  const markClusterRead = useCallback((cluster) => {
    const ids = cluster.articles.map(a => a.id);
    // Optimistic update: estado primero, IndexedDB en background
    setReadIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    markAllRead(ids).catch(console.error);
  }, [setReadIds]);

  const markClusterUnread = useCallback((cluster) => {
    const ids = cluster.articles.map(a => a.id);
    // Optimistic update: quitar IDs del set, IndexedDB en background
    setReadIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    Promise.all(ids.map(id => markRead(id, false))).catch(console.error);
  }, [setReadIds]);

  // ─── Guardar / quitar de biblioteca ──────────────────────────────────────────
  const toggleSaved = useCallback((cluster) => {
    if (savedIds.has(cluster.id)) {
      removeSavedCluster(cluster.id);
    } else {
      addSavedCluster(cluster);
    }
  }, [savedIds, addSavedCluster, removeSavedCluster]);

  // ─── Actualizar summary de un cluster ────────────────────────────────────────
  const updateClusterSummary = useCallback((clusterId, summary) => {
    setClusters(_cache.clusters.map(c => c.id === clusterId ? { ...c, summary } : c));
  }, [setClusters]);

  return {
    clusters,
    readIds,
    loading,
    refreshing,
    error,
    lastFetch,
    refresh: () => fetchNews({ force: true }),
    toggleRead,
    markClusterRead,
    markClusterUnread,
    updateClusterSummary,
    savedClusters,
    savedIds,
    toggleSaved,
  };
}

/**
 * useNews.js — Hook principal del módulo de noticias.
 *
 * Responsabilidades:
 *  - Llama /api/news/fetch → artículos crudos
 *  - Llama /api/news/cluster → clusters
 *  - Persiste en IndexedDB (caché 1h para clusters, artículos 7d)
 *  - Gestiona el estado read/unread
 *  - Expone refresh() para forzar recarga
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore.js';
import {
  saveArticles, getArticles, clearOldArticles,
  getReadState, markRead, markAllRead,
  getCachedClusters, saveClusters,
} from '../services/db.js';

const FETCH_ENDPOINT   = '/api/news/fetch';
const CLUSTER_ENDPOINT = '/api/news/cluster';
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1h

export function useNews() {
  const feeds            = useSettingsStore(s => s.feeds);
  const newsMaxPerFeed   = useSettingsStore(s => s.newsMaxPerFeed);
  const clusterThreshold = useSettingsStore(s => s.clusterThreshold);

  const [clusters,   setClusters]   = useState([]);
  const [readIds,    setReadIds]     = useState(new Set());
  const [loading,    setLoading]     = useState(false);
  const [refreshing, setRefreshing]  = useState(false);
  const [error,      setError]       = useState(null);
  const [lastFetch,  setLastFetch]   = useState(null);

  const timerRef = useRef(null);

  // ─── Clave de caché: hash simple de feeds activos + threshold ────────────────
  const cacheKey = feeds
    .filter(f => f.active)
    .map(f => f.id)
    .sort()
    .join(',') + `:${clusterThreshold}`;

  // ─── Cargar read-state desde IndexedDB ───────────────────────────────────────
  useEffect(() => {
    getReadState().then(setReadIds);
    clearOldArticles();
  }, []);

  // ─── Fetch principal ──────────────────────────────────────────────────────────
  const fetchNews = useCallback(async ({ force = false } = {}) => {
    const activeFeeds = feeds.filter(f => f.active);
    if (activeFeeds.length === 0) return;

    // Intentar caché primero (si no es refresh forzado)
    if (!force) {
      const cached = await getCachedClusters(cacheKey);
      if (cached) {
        setClusters(cached);
        setLastFetch(new Date());
        return;
      }
    }

    setLoading(clusters.length === 0);
    setRefreshing(clusters.length > 0);
    setError(null);

    try {
      // 1. Fetch artículos crudos del backend
      const fetchRes = await fetch(FETCH_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ feeds: activeFeeds, maxPerFeed: newsMaxPerFeed }),
      });
      if (!fetchRes.ok) throw new Error(`Feed fetch error: ${fetchRes.status}`);
      const { articles } = await fetchRes.json();

      // 2. Persistir artículos en IndexedDB
      await saveArticles(articles);

      // 3. Clusterizar en el backend
      const clusterRes = await fetch(CLUSTER_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ articles, threshold: clusterThreshold }),
      });
      if (!clusterRes.ok) throw new Error(`Cluster error: ${clusterRes.status}`);
      const { clusters: newClusters } = await clusterRes.json();

      // 4. Guardar en caché IndexedDB
      await saveClusters(cacheKey, newClusters);

      setClusters(newClusters);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
      // Intentar mostrar artículos cacheados si hay un error de red
      const offlineArticles = await getArticles();
      if (offlineArticles.length > 0) {
        const clusterRes = await fetch(CLUSTER_ENDPOINT, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ articles: offlineArticles, threshold: clusterThreshold }),
        }).catch(() => null);
        if (clusterRes?.ok) {
          const { clusters: offlineClusters } = await clusterRes.json();
          setClusters(offlineClusters);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feeds, newsMaxPerFeed, clusterThreshold, cacheKey, clusters.length]);

  // ─── Carga inicial + auto-refresh ─────────────────────────────────────────────
  useEffect(() => {
    fetchNews();
    timerRef.current = setInterval(() => fetchNews(), REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchNews]);

  // ─── Marcar leído / no leído ──────────────────────────────────────────────────
  const toggleRead = useCallback(async (articleId) => {
    const isRead = readIds.has(articleId);
    await markRead(articleId, !isRead);
    setReadIds(prev => {
      const next = new Set(prev);
      isRead ? next.delete(articleId) : next.add(articleId);
      return next;
    });
  }, [readIds]);

  const markClusterRead = useCallback(async (cluster) => {
    const ids = cluster.articles.map(a => a.id);
    await markAllRead(ids);
    setReadIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }, []);

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
  };
}

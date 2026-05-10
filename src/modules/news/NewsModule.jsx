import { useState, useCallback, useRef, useEffect } from 'react';
import { useNews } from '../../hooks/useNews.js';
import { useSwipeBack } from '../../hooks/useSwipeBack.js';
import { useSettingsStore, PROVIDER_CATALOG } from '../../store/settingsStore.js';
import StoryCard from './components/StoryCard.jsx';
import ArticleReader from './components/ArticleReader.jsx';
import styles from './NewsModule.module.css';

// ─── Obtener payload de provider (async, refresca token Copilot si es necesario) ──
async function getProviderPayload() {
  const store = useSettingsStore.getState();
  const { providers, activeProvider, githubToken } = store;

  const providerId = activeProvider
    || PROVIDER_CATALOG.find(p => providers[p.id]?.enabled && !p.local)?.id;

  if (!providerId) return null;
  const meta = PROVIDER_CATALOG.find(p => p.id === providerId);
  if (!meta || meta.local) return null;
  const cfg = providers[providerId] || {};

  if (providerId === 'copilot') {
    if (!githubToken) return null;
    const expiresAt  = cfg.copilotExpiresAt ? new Date(cfg.copilotExpiresAt * 1000) : null;
    const needsRefresh = !cfg.copilotToken || !expiresAt || expiresAt < new Date(Date.now() + 60_000);
    let sessionToken = cfg.copilotToken;
    if (needsRefresh) {
      try {
        const res  = await fetch('/api/copilot/token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ github_token: githubToken }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        sessionToken = data.token;
        store.setProvider('copilot', { copilotToken: data.token, copilotExpiresAt: data.expires_at });
      } catch { return null; }
    }
    return { id: 'copilot', model: cfg.model || meta.defaultModel, apiKey: sessionToken, baseUrl: meta.defaultBaseUrl };
  }

  if (!cfg.apiKey) return null;
  return { id: providerId, model: cfg.model || meta.defaultModel, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl || meta.defaultBaseUrl };
}

// ─── Generar resumen para un único cluster ────────────────────────────────────
async function fetchSummary(cluster, provider, signal) {
  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cluster, provider, type: 'cluster' }),
    signal,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.title && data.summary) ? data : null;
}

// ─── Banner de recordatorio de exportar ───────────────────────────────────────
const EXPORT_REMINDER_KEY = 'jarvis:exportReminderDismissed';
const EXPORT_REMINDER_DAYS = 14; // recordar cada 14 días

function shouldShowExportReminder(savedCount) {
  if (savedCount === 0) return false;
  try {
    const raw = sessionStorage.getItem(EXPORT_REMINDER_KEY);
    if (raw) return false; // ya descartado en esta sesión
    const ls = localStorage.getItem('jarvis:lastExportReminder');
    if (ls) {
      const daysSince = (Date.now() - parseInt(ls, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < EXPORT_REMINDER_DAYS) return false;
    }
    return true;
  } catch { return false; }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NewsModule() {
  const {
    clusters, readIds, loading, refreshing, error, lastFetch,
    refresh, toggleRead, markClusterRead, markClusterUnread,
    updateClusterSummary, savedClusters, savedIds, toggleSaved,
  } = useNews();

  const exportSettings = useSettingsStore(s => s.exportSettings);

  const [activeTab,      setActiveTab]      = useState('unread');
  const [openCluster,    setOpenCluster]    = useState(null);
  const [openArticle,    setOpenArticle]    = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [noProvider,     setNoProvider]     = useState(false);
  const [showExportBanner, setShowExportBanner] = useState(() =>
    shouldShowExportReminder(0) // se evalúa correctamente en efecto
  );

  const summaryAbortRef   = useRef(null);
  const batchAbortRef     = useRef(null);
  const attemptedIds      = useRef(new Set());

  // Mostrar banner si hay guardadas y no se ha descartado
  useEffect(() => {
    setShowExportBanner(shouldShowExportReminder(savedClusters.length));
  }, [savedClusters.length]);

  function dismissExportBanner() {
    try {
      sessionStorage.setItem(EXPORT_REMINDER_KEY, '1');
      localStorage.setItem('jarvis:lastExportReminder', Date.now().toString());
    } catch { /* ignore */ }
    setShowExportBanner(false);
  }

  function handleExportFromBanner() {
    exportSettings();
    dismissExportBanner();
  }

  // ─── Limpiar estado de detalle ────────────────────────────────────────────
  const clearDetail = useCallback(() => {
    summaryAbortRef.current?.abort();
    setOpenArticle(null);
    setOpenCluster(null);
    setNoProvider(false);
  }, []);

  // ─── History management ───────────────────────────────────────────────────
  const clusterId = openCluster?.id ?? null;
  useEffect(() => {
    if (clusterId) window.history.pushState({ newsDetail: true }, '');
  }, [clusterId]);

  useEffect(() => {
    const onPopState = () => clearDetail();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [clearDetail]);

  const handleBack = useCallback(() => window.history.back(), []);

  // ─── Filtros por tab ───────────────────────────────────────────────────────
  const unreadClusters  = clusters.filter(c => c.articles.some(a => !readIds.has(a.id)));
  const readClusters    = clusters.filter(c => c.articles.every(a =>  readIds.has(a.id)));

  const visibleClusters = activeTab === 'unread'  ? unreadClusters
                        : activeTab === 'read'    ? readClusters
                        : savedClusters; // 'saved'

  // ─── Generación batch de resúmenes al cargar ───────────────────────────────
  useEffect(() => {
    if (loading || clusters.length === 0) return;
    const pending = clusters.filter(
      c => !c.summary && !attemptedIds.current.has(c.id)
    ).slice(0, 6);
    if (pending.length === 0) return;

    const controller = new AbortController();
    batchAbortRef.current = controller;

    (async () => {
      const provider = await getProviderPayload();
      if (!provider || controller.signal.aborted) return;
      for (const cluster of pending) {
        if (controller.signal.aborted) break;
        attemptedIds.current.add(cluster.id);
        try {
          const summary = await fetchSummary(cluster, provider, controller.signal);
          if (summary) updateClusterSummary(cluster.id, summary);
          await new Promise(r => setTimeout(r, 600));
        } catch { /* ignorar */ }
      }
    })();

    return () => controller.abort();
  }, [loading, clusters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Resumen al abrir cluster ─────────────────────────────────────────────
  const generateSummary = useCallback(async (cluster) => {
    if (cluster.summary) return;
    setNoProvider(false);
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    const provider = await getProviderPayload();
    if (!provider) { setNoProvider(true); return; }

    setSummaryLoading(true);
    try {
      const summary = await fetchSummary(cluster, provider, controller.signal);
      if (summary) {
        updateClusterSummary(cluster.id, summary);
        setOpenCluster(prev => prev?.id === cluster.id ? { ...prev, summary } : prev);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Summary error:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [updateClusterSummary]);

  // ─── Navegación ───────────────────────────────────────────────────────────
  const handleClusterOpen = useCallback((cluster) => {
    setOpenCluster(cluster);
    setOpenArticle(null);
    generateSummary(cluster);
  }, [generateSummary]);

  const handleArticleOpen = useCallback((article) => {
    setOpenArticle(article);
    toggleRead(article.id);
  }, [toggleRead]);

  // ─── Swipe back ───────────────────────────────────────────────────────────
  const swipeBackProps = useSwipeBack(handleBack, !!(openCluster || openArticle));

  // ─── Vista: lector de artículo ──────────────────────────────────────────
  if (openArticle) {
    return (
      <div {...swipeBackProps} style={{ height: '100%' }}>
        <ArticleReader article={openArticle} onBack={handleBack} />
      </div>
    );
  }

  // ─── Vista: cluster detail ────────────────────────────────────────────────
  if (openCluster) {
    const summaryObj    = openCluster.summary;
    const mainArticle   = openCluster.articles[0];
    const otherArticles = openCluster.articles.slice(1);
    const clusterSaved  = savedIds.has(openCluster.id);

    return (
      <div {...swipeBackProps} style={{ height: '100%' }}>
        <div className={styles.view}>
          <header className={styles.header}>
            <button className={styles.backBtn} onClick={handleBack} aria-label="Volver">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <h1 className={styles.headerTitle}>{openCluster.category}</h1>
            <button
              className={[styles.saveDetailBtn, clusterSaved ? styles.saveDetailBtnActive : ''].join(' ')}
              onClick={() => toggleSaved(openCluster)}
              aria-label={clusterSaved ? 'Quitar de guardadas' : 'Guardar'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={clusterSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button className={styles.markReadBtn} onClick={() => markClusterRead(openCluster)}>
              Leído
            </button>
          </header>

          <div className={styles.clusterScroll}>
            <h2 className={styles.clusterTitle}>{openCluster.mainTitle}</h2>

            {(summaryLoading || summaryObj || noProvider) && (
              <div className={styles.aiSummary}>
                <span className={styles.aiLabel}>Resumen IA</span>
                {summaryLoading && !summaryObj && (
                  <span className={styles.aiSpinner}>Generando…</span>
                )}
                {noProvider && !summaryObj && (
                  <span className={styles.aiSpinner}>
                    Configura un provider en Ajustes para ver el resumen.
                  </span>
                )}
                {summaryObj && (
                  <>
                    {summaryObj.title && (
                      <strong className={styles.aiTitle}>{summaryObj.title}</strong>
                    )}
                    <p>{summaryObj.summary}</p>
                  </>
                )}
              </div>
            )}

            <button
              className={styles.readFullBtn}
              onClick={() => handleArticleOpen(mainArticle)}
            >
              <span>Ver noticia completa</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

            {otherArticles.length > 0 && (
              <>
                <div className={styles.otherSourcesLabel}>Otras fuentes</div>
                <ul className={styles.articleList}>
                  {otherArticles.map(article => (
                    <li key={article.id}>
                      <button
                        className={[styles.articleItem, readIds.has(article.id) ? styles.articleRead : ''].join(' ')}
                        onClick={() => handleArticleOpen(article)}
                      >
                        {article.image && (
                          <img src={article.image} alt="" className={styles.articleThumb} loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={e => { e.currentTarget.style.display = 'none'; }} />
                        )}
                        <div className={styles.articleMeta}>
                          <span className={styles.articleSource}>{article.source}</span>
                          <span className={styles.articleTitle}>{article.title}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista principal: feed ─────────────────────────────────────────────────
  const emptyMessages = {
    unread: 'Todo al día. No hay noticias sin leer.',
    read:   'Aún no has leído ninguna noticia.',
    saved:  'No tienes noticias guardadas. Pulsa el marcador en cualquier noticia para guardarla.',
  };

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Noticias</h1>
        <button
          className={[styles.refreshBtn, refreshing ? styles.refreshing : ''].join(' ')}
          onClick={refresh}
          disabled={loading || refreshing}
          aria-label="Actualizar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </header>

      {/* Banner de recordatorio de exportar */}
      {showExportBanner && (
        <div className={styles.exportBanner}>
          <span className={styles.exportBannerText}>
            💾 Tienes {savedClusters.length} noticia{savedClusters.length !== 1 ? 's' : ''} guardada{savedClusters.length !== 1 ? 's' : ''}. Exporta tus datos para no perderlos si reinstalar la app.
          </span>
          <div className={styles.exportBannerActions}>
            <button className={styles.exportBannerBtn} onClick={handleExportFromBanner}>Exportar</button>
            <button className={styles.exportBannerDismiss} onClick={dismissExportBanner}>✕</button>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        <button
          className={[styles.tab, activeTab === 'unread' ? styles.tabActive : ''].join(' ')}
          onClick={() => setActiveTab('unread')}
        >
          Por leer {unreadClusters.length > 0 && <span className={styles.tabBadge}>{unreadClusters.length}</span>}
        </button>
        <button
          className={[styles.tab, activeTab === 'read' ? styles.tabActive : ''].join(' ')}
          onClick={() => setActiveTab('read')}
        >
          Leídas {readClusters.length > 0 && <span className={styles.tabBadge}>{readClusters.length}</span>}
        </button>
        <button
          className={[styles.tab, activeTab === 'saved' ? styles.tabActive : ''].join(' ')}
          onClick={() => setActiveTab('saved')}
        >
          Guardadas {savedClusters.length > 0 && <span className={styles.tabBadge}>{savedClusters.length}</span>}
        </button>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          <span>Error cargando feeds: {error}</span>
        </div>
      )}

      {loading && activeTab !== 'saved' && (
        <div className={styles.loadingList}>
          {[...Array(4)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {!loading && visibleClusters.length === 0 && !error && (
        <div className={styles.empty}>
          <p>{emptyMessages[activeTab]}</p>
        </div>
      )}

      {(!loading || activeTab === 'saved') && visibleClusters.length > 0 && (
        <ul className={styles.storyList}>
          {visibleClusters.map(cluster => (
            <li key={cluster.id}>
              <StoryCard
                cluster={cluster}
                isRead={false}
                swipeAction={activeTab === 'read' ? 'unread' : 'read'}
                onOpen={handleClusterOpen}
                onMarkRead={markClusterRead}
                onMarkUnread={markClusterUnread}
                isSaved={savedIds.has(cluster.id)}
                onToggleSaved={toggleSaved}
              />
            </li>
          ))}
        </ul>
      )}

      {lastFetch && activeTab !== 'saved' && (
        <p className={styles.lastFetch}>
          Actualizado: {lastFetch.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

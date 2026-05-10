import { useState, useCallback } from 'react';
import { useNews } from '../../hooks/useNews.js';
import StoryCard from './components/StoryCard.jsx';
import ArticleReader from './components/ArticleReader.jsx';
import styles from './NewsModule.module.css';

export default function NewsModule() {
  const { clusters, readIds, loading, refreshing, error, lastFetch, refresh, toggleRead, markClusterRead } = useNews();
  const [openCluster, setOpenCluster] = useState(null);
  const [openArticle, setOpenArticle] = useState(null);

  const handleClusterOpen = useCallback((cluster) => {
    setOpenCluster(cluster);
    setOpenArticle(null);
  }, []);

  const handleArticleOpen = useCallback((article) => {
    setOpenArticle(article);
    toggleRead(article.id);
  }, [toggleRead]);

  const handleBack = useCallback(() => {
    if (openArticle) { setOpenArticle(null); return; }
    setOpenCluster(null);
  }, [openArticle]);

  // ── Vista: lector de artículo ──────────────────────────────────────────────
  if (openArticle) {
    return (
      <ArticleReader
        article={openArticle}
        onBack={handleBack}
      />
    );
  }

  // ── Vista: lista de artículos de un cluster ────────────────────────────────
  if (openCluster) {
    return (
      <div className={styles.view}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={handleBack} aria-label="Volver">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h1 className={styles.headerTitle}>{openCluster.category}</h1>
          <button className={styles.markReadBtn} onClick={() => { markClusterRead(openCluster); }}>
            Todo leído
          </button>
        </header>

        {openCluster.summary && (
          <div className={styles.aiSummary}>
            <span className={styles.aiLabel}>Resumen IA</span>
            <p>{openCluster.summary}</p>
          </div>
        )}

        <ul className={styles.articleList}>
          {openCluster.articles.map(article => (
            <li key={article.id}>
              <button
                className={[styles.articleItem, readIds.has(article.id) ? styles.articleRead : ''].join(' ')}
                onClick={() => handleArticleOpen(article)}
              >
                {article.image && (
                  <img src={article.image} alt="" className={styles.articleThumb} loading="lazy" />
                )}
                <div className={styles.articleMeta}>
                  <span className={styles.articleSource}>{article.source}</span>
                  <span className={styles.articleTitle}>{article.title}</span>
                  {article.description && (
                    <span className={styles.articleDesc}>{article.description}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Vista principal: feed de clusters ─────────────────────────────────────
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

      {error && (
        <div className={styles.error} role="alert">
          <span>Error cargando feeds: {error}</span>
        </div>
      )}

      {loading && (
        <div className={styles.loadingList}>
          {[...Array(5)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      )}

      {!loading && clusters.length === 0 && !error && (
        <div className={styles.empty}>
          <p>No hay artículos. Configura feeds en Ajustes.</p>
        </div>
      )}

      {!loading && (
        <ul className={styles.storyList}>
          {clusters.map(cluster => (
            <li key={cluster.id}>
              <StoryCard
                cluster={cluster}
                isRead={cluster.articles.every(a => readIds.has(a.id))}
                onOpen={handleClusterOpen}
              />
            </li>
          ))}
        </ul>
      )}

      {lastFetch && (
        <p className={styles.lastFetch}>
          Actualizado: {lastFetch.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

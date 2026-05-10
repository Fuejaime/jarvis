import styles from './StoryCard.module.css';

/**
 * StoryCard — Tarjeta de un cluster de artículos en el feed principal.
 */
export default function StoryCard({ cluster, isRead, onOpen }) {
  const articleCount = cluster.articles.length;
  const sources      = cluster.sources.slice(0, 3);

  return (
    <button
      className={[styles.card, isRead ? styles.read : ''].join(' ')}
      onClick={() => onOpen(cluster)}
    >
      {cluster.image && (
        <img
          src={cluster.image}
          alt=""
          className={styles.image}
          loading="lazy"
          decoding="async"
        />
      )}

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.category}>{cluster.category}</span>
          {articleCount > 1 && (
            <span className={styles.count}>{articleCount} artículos</span>
          )}
        </div>

        <h2 className={styles.title}>
          {cluster.summary?.title || cluster.mainTitle}
        </h2>

        {cluster.summary?.summary && (
          <p className={styles.summary}>{cluster.summary.summary}</p>
        )}

        <div className={styles.footer}>
          <span className={styles.sources}>{sources.join(' · ')}</span>
          <span className={styles.date}>{formatRelative(cluster.date)}</span>
        </div>
      </div>

      <div className={styles.chevron} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </button>
  );
}

function formatRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'Ahora';
  if (m < 60)  return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  return `Hace ${d}d`;
}

import { useState, useRef } from 'react';
import styles from './StoryCard.module.css';

const SWIPE_THRESHOLD = 80;  // px para confirmar acción
const SWIPE_MAX       = 120; // px máximo de desplazamiento visual

/**
 * StoryCard — Tarjeta de un cluster en el feed principal.
 *
 * Props:
 *   cluster        — objeto cluster
 *   isRead         — aplica clase .read (opacidad reducida)
 *   onOpen         — callback al pulsar la tarjeta
 *   onMarkRead     — callback para marcar como leído (swipeAction='read')
 *   onMarkUnread   — callback para marcar como no leído (swipeAction='unread')
 *   swipeAction    — 'read' | 'unread' (qué hace el swipe derecha)
 *   isSaved        — si el cluster está en la biblioteca
 *   onToggleSaved  — callback para guardar/quitar de biblioteca
 */
export default function StoryCard({
  cluster,
  isRead = false,
  onOpen,
  onMarkRead,
  onMarkUnread,
  swipeAction = 'read',
  isSaved = false,
  onToggleSaved,
}) {
  const articleCount = cluster.articles.length;
  const sources      = cluster.sources.slice(0, 3);

  // ── Swipe gesture ─────────────────────────────────────────────────────────
  const touchStart  = useRef(null);
  const [swipeX,    setSwipeX]    = useState(0);
  const [dragging,  setDragging]  = useState(false);

  function handleTouchStart(e) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setDragging(false);
  }

  function handleTouchMove(e) {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStart.current.y);
    if (dx < 10 || dy > dx * 0.8) return;
    setDragging(true);
    setSwipeX(Math.min(dx, SWIPE_MAX));
  }

  function handleTouchEnd() {
    if (swipeX > SWIPE_THRESHOLD) {
      if (swipeAction === 'read'   && onMarkRead)   onMarkRead(cluster);
      if (swipeAction === 'unread' && onMarkUnread)  onMarkUnread(cluster);
    }
    setSwipeX(0);
    setDragging(false);
    touchStart.current = null;
  }

  const confirmed  = swipeX > SWIPE_THRESHOLD;
  // Opacidad del fondo: crece con el desplazamiento, empieza en 0
  const bgOpacity  = Math.min(swipeX / SWIPE_MAX, 1) * 0.9;
  // Sólo montar el swipeBg mientras hay movimiento activo — evita cualquier bleed-through
  const showBg = swipeX > 0;

  return (
    <div className={styles.wrapper}>

      {/* Fondo que emerge al deslizar — solo existe en DOM durante el gesto */}
      {showBg && (
        <div
          className={[
            styles.swipeBg,
            swipeAction === 'unread' ? styles.swipeBgUnread : '',
            confirmed ? styles.swipeBgConfirmed : '',
          ].join(' ')}
          style={{ opacity: bgOpacity }}
          aria-hidden="true"
        >
          {swipeAction === 'read' ? (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Leído</span>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h14M9 6l-6 6 6 6"/>
              </svg>
              <span>No leída</span>
            </>
          )}
        </div>
      )}

      {/* Tarjeta principal */}
      <button
        className={[styles.card, isRead ? styles.read : ''].join(' ')}
        style={{
          transform:  swipeX > 0 ? `translateX(${swipeX}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.25s ease',
        }}
        onClick={() => { if (!dragging) onOpen(cluster); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {cluster.image && (
          <img
            src={cluster.image}
            alt=""
            className={styles.hero}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}

        <div className={styles.body}>
          <div className={styles.meta}>
            <span className={styles.category}>{cluster.category}</span>
            {articleCount > 1 && (
              <span className={styles.count}>{articleCount} fuentes</span>
            )}
          </div>

          <h2 className={styles.title}>{cluster.mainTitle}</h2>

          <div className={styles.footer}>
            <span className={styles.sources}>{sources.join(' · ')}</span>
            <span className={styles.date}>{formatRelative(cluster.date)}</span>
          </div>
        </div>
      </button>

      {/* Bookmark — overlay fuera del <button> principal para evitar button-in-button */}
      {onToggleSaved && (
        <button
          className={[styles.saveBtn, isSaved ? styles.saveBtnActive : ''].join(' ')}
          onClick={() => onToggleSaved(cluster)}
          aria-label={isSaved ? 'Quitar de guardadas' : 'Guardar noticia'}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

    </div>
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

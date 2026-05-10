import { useState, useEffect } from 'react';
import { Readability } from '@mozilla/readability';
import styles from './EmbeddedArticle.module.css';

/**
 * EmbeddedArticle — Muestra el contenido completo de un artículo de forma inline,
 * sin chrome de navegación. Usado dentro de la vista de cluster ("Fuente oficial").
 */
export default function EmbeddedArticle({ article }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const res = await fetch('/api/news/article', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ url: article.url }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { html } = await res.json();

        const doc    = new DOMParser().parseFromString(html, 'text/html');
        // Fijar base URL para que las imágenes relativas resuelvan correctamente
        const base   = doc.createElement('base');
        base.href    = article.url;
        doc.head.appendChild(base);

        const reader = new Readability(doc);
        const parsed = reader.parse();
        if (!parsed) throw new Error('No se pudo extraer el contenido');
        if (!cancelled) setContent(parsed);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [article.url]);

  return (
    <section className={styles.wrap}>
      <div className={styles.sectionLabel}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Fuente oficial
        <span className={styles.source}>{article.source}</span>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.openLink}
          onClick={e => e.stopPropagation()}
        >
          Abrir →
        </a>
      </div>

      {loading && (
        <div className={styles.skeletons}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={styles.skeleton} style={{ width: `${65 + (i % 4) * 8}%` }} />
          ))}
        </div>
      )}

      {error && (
        <p className={styles.error}>
          No se pudo cargar el artículo completo.{' '}
          <a href={article.url} target="_blank" rel="noopener noreferrer">Abrir en Safari →</a>
        </p>
      )}

      {content && !loading && (
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: content.content }}
        />
      )}
    </section>
  );
}

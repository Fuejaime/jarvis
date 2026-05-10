import { useState, useEffect, useRef } from 'react';
import { Readability } from '@mozilla/readability';
import styles from './ArticleReader.module.css';
import { useSettingsStore } from '../../../store/settingsStore.js';

/**
 * ArticleReader — Vista de lectura de un artículo individual.
 *
 * El backend solo hace fetch del HTML (proxy CORS).
 * El parseo con Readability se hace aquí con DOMParser (browser nativo).
 */
export default function ArticleReader({ article, onBack }) {
  const ttsEnabled = useSettingsStore(s => s.ttsEnabled);
  const ttsVoice   = useSettingsStore(s => s.ttsVoice);

  const [content,  setContent]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [speaking, setSpeaking] = useState(false);

  const utterRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1. Backend hace el fetch evitando CORS
        const res = await fetch('/api/news/article', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ url: article.url }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const { html, url } = await res.json();

        // 2. Parsear HTML con DOMParser (browser nativo, sin dependencias)
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 3. Extraer contenido limpio con Readability
        const reader  = new Readability(doc, { url });
        const parsed  = reader.parse();

        if (!parsed) throw new Error('No se pudo extraer el contenido del artículo');

        // Añadir referrerpolicy="no-referrer" a todas las imágenes del cuerpo
        // para evitar bloqueos de hotlink (Applesfera y otros usan el Referer)
        if (parsed.content) {
          parsed.content = parsed.content.replace(/<img\b/gi, '<img referrerpolicy="no-referrer"');
        }

        if (!cancelled) setContent(parsed);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => {
      cancelled = true;
      stopSpeech();
    };
  }, [article.url]);

  function stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }

  function toggleSpeech() {
    if (!('speechSynthesis' in window)) return;

    if (speaking) {
      stopSpeech();
      return;
    }

    const text = content?.textContent || article.description || article.title;
    if (!text) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = 'es-ES';
    utter.rate  = 1.05;

    if (ttsVoice) {
      const voices = window.speechSynthesis.getVoices();
      const voice  = voices.find(v => v.name === ttsVoice);
      if (voice) utter.voice = voice;
    }

    utter.onend   = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Volver">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <div className={styles.headerActions}>
          {ttsEnabled && !loading && !error && (
            <button
              className={[styles.actionBtn, speaking ? styles.speaking : ''].join(' ')}
              onClick={toggleSpeech}
              aria-label={speaking ? 'Detener lectura' : 'Escuchar artículo'}
            >
              {speaking ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              )}
            </button>
          )}

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.actionBtn}
            aria-label="Abrir en Safari"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      </header>

      <article className={styles.article}>
        {loading && (
          <div className={styles.loadingWrap}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeleton} style={{ width: `${70 + (i % 3) * 10}%` }} />
            ))}
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <p>No se pudo cargar el artículo.</p>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.openLink}>
              Abrir en el navegador →
            </a>
          </div>
        )}

        {content && !loading && (
          <>
            {article.image && (
              <img src={article.image} alt="" className={styles.hero} loading="eager" referrerPolicy="no-referrer" />
            )}

            <div className={styles.meta}>
              <span className={styles.source}>{article.source}</span>
              {content.byline && <span className={styles.byline}>{content.byline}</span>}
              {content.publishedTime && (
                <time className={styles.date}>
                  {new Date(content.publishedTime).toLocaleDateString('es', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </time>
              )}
            </div>

            <h1 className={styles.title}>{content.title || article.title}</h1>

            <div
              className={styles.body}
              dangerouslySetInnerHTML={{ __html: content.content }}
            />
          </>
        )}
      </article>
    </div>
  );
}

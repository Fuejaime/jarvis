import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Nav from './components/Nav.jsx';
import NewsModule from './modules/news/NewsModule.jsx';
import AssistantModule from './modules/assistant/AssistantModule.jsx';
import SettingsModule from './modules/settings/SettingsModule.jsx';
import { useSettingsStore } from './store/settingsStore.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import styles from './App.module.css';

export default function App() {
  const theme         = useSettingsStore(s => s.theme);
  const setGithubAuth = useSettingsStore(s => s.setGithubAuth);
  const { keyboardOpen } = useKeyboard();
  const appRef = useRef(null);

  // Sincronizar tema con el DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Capturar token de GitHub tras el callback OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubToken = params.get('github_token');
    const githubUser  = params.get('github_user');
    const authError   = params.get('auth_error');

    if (githubToken && githubUser) {
      setGithubAuth(githubToken, githubUser);
      window.history.replaceState({}, '', '/');
    } else if (authError) {
      console.error('GitHub OAuth error:', decodeURIComponent(authError));
      window.history.replaceState({}, '', '/');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Anclar el contenedor raíz al visual viewport.
   *
   * Problema en iOS PWA: cuando el teclado se abre, iOS puede "scrollear"
   * el layout viewport para llevar el input enfocado al viewport visual.
   * Eso desplaza los elementos position:fixed hacia arriba, rompiendo el layout.
   *
   * Solución: ajustar height y transform del .app container para que siempre
   * coincida exactamente con el visual viewport. Así:
   *   1. El contenedor se encoge cuando el teclado abre → el inputBar queda
   *      visible → iOS no necesita scrollear.
   *   2. Si iOS scrollea de todas formas (vv.offsetTop > 0), el translateY
   *      lo contrarresta, devolviendo el container a su posición correcta.
   */
  useEffect(() => {
    const vv  = window.visualViewport;
    const el  = appRef.current;
    if (!vv || !el) return;

    function sync() {
      el.style.height    = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    }

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    // Sync inicial para aplicar desde el primer render
    sync();

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      el.style.height    = '';
      el.style.transform = '';
    };
  }, []);

  return (
    <div ref={appRef} className={styles.app}>
      <main
        className={styles.content}
        style={keyboardOpen ? { paddingBottom: 0 } : undefined}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/news" replace />} />
          <Route path="/news" element={<NewsModule />} />
          <Route path="/assistant" element={<AssistantModule />} />
          <Route path="/settings" element={<SettingsModule />} />
          <Route path="*" element={<Navigate to="/news" replace />} />
        </Routes>
      </main>

      <Nav />
    </div>
  );
}

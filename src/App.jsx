import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
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

  // Sincronizar tema con el DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sincronizar altura del contenedor con el visualViewport.
  // En iOS PWA, el layout viewport no se reduce al abrir el teclado;
  // --vv-height refleja el área visible real para que el flex layout
  // empuje el inputBar justo encima del teclado.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      document.documentElement.style.setProperty('--vv-height', `${vv.height}px`);
    }

    vv.addEventListener('resize', update);
    update(); // valor inicial

    return () => vv.removeEventListener('resize', update);
  }, []);

  // Capturar token de GitHub tras el callback OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubToken = params.get('github_token');
    const githubUser  = params.get('github_user');
    const authError   = params.get('auth_error');

    if (githubToken && githubUser) {
      setGithubAuth(githubToken, githubUser);
      // Limpiar la URL para no exponer el token en el historial del navegador
      window.history.replaceState({}, '', '/');
    } else if (authError) {
      console.error('GitHub OAuth error:', decodeURIComponent(authError));
      window.history.replaceState({}, '', '/');
    }
  }, []); // Solo al montar

  return (
    <div className={styles.app}>
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

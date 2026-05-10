import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Nav from './components/Nav.jsx';
import NewsModule from './modules/news/NewsModule.jsx';
import AssistantModule from './modules/assistant/AssistantModule.jsx';
import SettingsModule from './modules/settings/SettingsModule.jsx';
import { useSettingsStore } from './store/settingsStore.js';
import styles from './App.module.css';

export default function App() {
  const theme = useSettingsStore(s => s.theme);

  // Sincronizar tema con el DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className={styles.app}>
      {/* Área de contenido principal — scroll independiente por módulo */}
      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<Navigate to="/news" replace />} />
          <Route path="/news" element={<NewsModule />} />
          <Route path="/assistant" element={<AssistantModule />} />
          <Route path="/settings" element={<SettingsModule />} />
          <Route path="*" element={<Navigate to="/news" replace />} />
        </Routes>
      </main>

      {/* Barra de navegación inferior fija (mobile-first) */}
      <Nav />
    </div>
  );
}

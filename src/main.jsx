import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';

// Aplicar tema guardado antes del primer render para evitar flash
const savedTheme = (() => {
  try {
    const s = JSON.parse(localStorage.getItem('jarvis-settings') || '{}');
    return s?.state?.theme || 'dark';
  } catch { return 'dark'; }
})();
document.documentElement.setAttribute('data-theme', savedTheme);

// Registrar Service Worker (lo gestiona vite-plugin-pwa)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* silent */});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

import { useState, useRef } from 'react';
import { useSettingsStore, PROVIDER_CATALOG } from '../../../store/settingsStore.js';
import styles from './Tab.module.css';

/**
 * ProvidersTab — Configura los providers de LLM.
 *
 * GitHub Copilot usa OAuth (botón "Conectar con GitHub").
 * El resto usan API key manual.
 */
export default function ProvidersTab() {
  const providers         = useSettingsStore(s => s.providers);
  const activeProvider    = useSettingsStore(s => s.activeProvider);
  const githubUser        = useSettingsStore(s => s.githubUser);
  const setProvider       = useSettingsStore(s => s.setProvider);
  const setActiveProvider = useSettingsStore(s => s.setActiveProvider);
  const clearGithubAuth   = useSettingsStore(s => s.clearGithubAuth);
  const exportSettings    = useSettingsStore(s => s.exportSettings);
  const importSettings    = useSettingsStore(s => s.importSettings);

  const [showKey,        setShowKey]        = useState({});
  const [importMsg,      setImportMsg]      = useState(null);
  const importFileRef = useRef(null);

  function handleToggle(id) {
    setProvider(id, { enabled: !providers[id]?.enabled });
    if (activeProvider === id && providers[id]?.enabled) setActiveProvider(null);
  }

  function handleField(id, field, value) {
    setProvider(id, { [field]: value });
  }

  function handleSetActive(id) {
    setActiveProvider(id);
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = importSettings(ev.target.result);
      setImportMsg(result.ok ? '✓ Ajustes importados correctamente' : `Error: ${result.error}`);
      setTimeout(() => setImportMsg(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const cloudProviders = PROVIDER_CATALOG.filter(p => !p.local);
  const localProviders = PROVIDER_CATALOG.filter(p => p.local);

  return (
    <div className={styles.section}>
      <p className={styles.hint}>
        Los providers locales (Ollama, LM Studio, MLX) solo funcionan cuando el iPhone está en la misma red WiFi que tu Mac.
      </p>

      <h2 className={styles.groupTitle}>Cloud</h2>
      {cloudProviders.map(meta => (
        meta.oauth ? (
          <CopilotCard
            key={meta.id}
            meta={meta}
            cfg={providers[meta.id] || {}}
            isActive={activeProvider === meta.id}
            githubUser={githubUser}
            onSetActive={() => handleSetActive(meta.id)}
            onDisconnect={clearGithubAuth}
            onToggle={() => handleToggle(meta.id)}
            onField={(f, v) => handleField(meta.id, f, v)}
          />
        ) : (
          <ProviderCard
            key={meta.id}
            meta={meta}
            cfg={providers[meta.id] || {}}
            isActive={activeProvider === meta.id}
            showKey={!!showKey[meta.id]}
            onToggle={() => handleToggle(meta.id)}
            onField={(f, v) => handleField(meta.id, f, v)}
            onSetActive={() => handleSetActive(meta.id)}
            onToggleKey={() => setShowKey(prev => ({ ...prev, [meta.id]: !prev[meta.id] }))}
          />
        )
      ))}

      <h2 className={styles.groupTitle}>Local (misma WiFi)</h2>
      {localProviders.map(meta => (
        <ProviderCard
          key={meta.id}
          meta={meta}
          cfg={providers[meta.id] || {}}
          isActive={activeProvider === meta.id}
          showKey={false}
          onToggle={() => handleToggle(meta.id)}
          onField={(f, v) => handleField(meta.id, f, v)}
          onSetActive={() => handleSetActive(meta.id)}
          onToggleKey={() => {}}
        />
      ))}

      {/* ── Export / Import ── */}
      <h2 className={styles.groupTitle}>Copia de seguridad</h2>
      <div className={styles.card}>
        <p className={styles.hint} style={{ margin: '0 0 12px' }}>
          En iOS, Safari puede borrar el almacenamiento local si no usas la app durante 7 días.
          Exporta tus ajustes para no perder tus API keys.
        </p>
        <div className={styles.exportRow}>
          <button className={styles.exportBtn} onClick={exportSettings}>
            Exportar ajustes
          </button>
          <button className={styles.exportBtn} onClick={() => importFileRef.current?.click()}>
            Importar ajustes
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
        {importMsg && <p className={styles.importMsg}>{importMsg}</p>}
      </div>
    </div>
  );
}

// ── GitHub Copilot card (OAuth) ───────────────────────────────────────────────

function CopilotCard({ meta, cfg, isActive, githubUser, onSetActive, onDisconnect, onToggle, onField }) {
  const connected = !!githubUser;
  const enabled   = !!cfg.enabled;

  return (
    <div className={[styles.card, enabled ? styles.cardEnabled : ''].join(' ')}>
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.cardTitle}>{meta.name}</span>
          <span className={styles.oauthBadge}>OAuth</span>
          {isActive && <span className={styles.activeBadge}>activo</span>}
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>

      {enabled && (
        <div className={styles.cardBody}>
          {connected ? (
            <>
              <p className={styles.connectedInfo}>
                Conectado como <strong>@{githubUser}</strong>
              </p>

              {/* Selector de modelo */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Modelo</label>
                <select
                  className={styles.select}
                  value={cfg.model || meta.defaultModel}
                  onChange={(e) => onField('model', e.target.value)}
                >
                  {meta.models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {!isActive && (
                <button className={styles.setActiveBtn} onClick={onSetActive}>
                  Usar como provider activo
                </button>
              )}

              <button className={styles.disconnectBtn} onClick={onDisconnect}>
                Desconectar de GitHub
              </button>
            </>
          ) : (
            <>
              <p className={styles.hint}>
                Conecta tu cuenta de GitHub con Copilot para usar este provider. No necesitas API key.
              </p>
              <p className={styles.hint}>
                <strong>Requisito:</strong> Necesitas una suscripción activa de GitHub Copilot y crear un OAuth App en{' '}
                <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer">
                  github.com/settings/developers
                </a>
                {' '}con la URL de callback: <code>https://jarvis-pwa-one.vercel.app/api/auth/github/callback</code>
              </p>
              <a
                className={styles.githubBtn}
                href="/api/auth/github"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z"/>
                </svg>
                Conectar con GitHub
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Provider card genérico ────────────────────────────────────────────────────

function ProviderCard({ meta, cfg, isActive, showKey, onToggle, onField, onSetActive, onToggleKey }) {
  const enabled = !!cfg.enabled;

  return (
    <div className={[styles.card, enabled ? styles.cardEnabled : ''].join(' ')}>
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.cardTitle}>{meta.name}</span>
          {meta.local && <span className={styles.localBadge}>local</span>}
          {isActive && <span className={styles.activeBadge}>activo</span>}
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>

      {enabled && (
        <div className={styles.cardBody}>
          {/* API key */}
          {meta.needsApiKey && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>API Key</label>
              <div className={styles.inputRow}>
                <input
                  type={showKey ? 'text' : 'password'}
                  className={styles.input}
                  value={cfg.apiKey || ''}
                  onChange={(e) => onField('apiKey', e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                />
                <button className={styles.eyeBtn} onClick={onToggleKey}>
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          )}

          {/* Base URL (providers locales) */}
          {meta.needsBaseUrl && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>URL del servidor</label>
              <input
                type="url"
                className={styles.input}
                value={cfg.baseUrl || meta.defaultBaseUrl || ''}
                onChange={(e) => onField('baseUrl', e.target.value)}
                placeholder={meta.defaultBaseUrl}
              />
            </div>
          )}

          {/* Modelo */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Modelo</label>
            {meta.models.length > 0 ? (
              <select
                className={styles.select}
                value={cfg.model || meta.defaultModel}
                onChange={(e) => onField('model', e.target.value)}
              >
                {meta.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input
                type="text"
                className={styles.input}
                value={cfg.model || meta.defaultModel}
                onChange={(e) => onField('model', e.target.value)}
                placeholder="nombre-del-modelo"
              />
            )}
          </div>

          {!isActive && (
            <button className={styles.setActiveBtn} onClick={onSetActive}>
              Usar como provider activo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={[styles.toggle, checked ? styles.toggleOn : ''].join(' ')}
      onClick={onChange}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

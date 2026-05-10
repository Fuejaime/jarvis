import { useState } from 'react';
import { useSettingsStore, PROVIDER_CATALOG } from '../../../store/settingsStore.js';
import styles from './Tab.module.css';

/**
 * ProvidersTab — Configura los providers de LLM.
 *
 * Cada provider tiene:
 *  - Toggle enabled/disabled
 *  - Campo API key (si aplica)
 *  - Campo base URL (si es local)
 *  - Selector de modelo
 *  - Botón "Usar por defecto"
 */
export default function ProvidersTab() {
  const providers      = useSettingsStore(s => s.providers);
  const activeProvider = useSettingsStore(s => s.activeProvider);
  const setProvider    = useSettingsStore(s => s.setProvider);
  const setActiveProvider = useSettingsStore(s => s.setActiveProvider);

  const [showKey, setShowKey] = useState({});

  function handleToggle(id) {
    setProvider(id, { enabled: !providers[id]?.enabled });
    // Si se desactiva el activo, limpiar activeProvider
    if (activeProvider === id && providers[id]?.enabled) {
      setActiveProvider(null);
    }
  }

  function handleField(id, field, value) {
    setProvider(id, { [field]: value });
  }

  function handleSetActive(id) {
    setActiveProvider(id);
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
    </div>
  );
}

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
                {meta.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
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

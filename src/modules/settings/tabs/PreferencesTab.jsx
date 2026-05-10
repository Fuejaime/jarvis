import { useSettingsStore } from '../../../store/settingsStore.js';
import { useTTS } from '../../../hooks/useTTS.js';
import styles from './Tab.module.css';

export default function PreferencesTab() {
  const theme              = useSettingsStore(s => s.theme);
  const setTheme           = useSettingsStore(s => s.setTheme);
  const systemPrompt       = useSettingsStore(s => s.systemPrompt);
  const setSystemPrompt    = useSettingsStore(s => s.setSystemPrompt);
  const newsMaxPerFeed     = useSettingsStore(s => s.newsMaxPerFeed);
  const setNewsMaxPerFeed  = useSettingsStore(s => s.setNewsMaxPerFeed);
  const sttProvider        = useSettingsStore(s => s.sttProvider);
  const setSttProvider     = useSettingsStore(s => s.setSttProvider);
  const ttsEnabled         = useSettingsStore(s => s.ttsEnabled);
  const setTtsEnabled      = useSettingsStore(s => s.setTtsEnabled);
  const ttsVoice           = useSettingsStore(s => s.ttsVoice);
  const setTtsVoice        = useSettingsStore(s => s.setTtsVoice);

  const { voices } = useTTS();

  const spanishVoices = voices.filter(v => v.lang.startsWith('es'));

  return (
    <div className={styles.section}>
      {/* Tema */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Apariencia</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Tema</label>
            <div className={styles.segmented}>
              <button
                className={[styles.segment, theme === 'dark' ? styles.segmentActive : ''].join(' ')}
                onClick={() => setTheme('dark')}
              >Oscuro</button>
              <button
                className={[styles.segment, theme === 'light' ? styles.segmentActive : ''].join(' ')}
                onClick={() => setTheme('light')}
              >Claro</button>
            </div>
          </div>
        </div>
      </div>

      {/* Noticias */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Noticias</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Artículos por feed: {newsMaxPerFeed}</label>
            <input
              type="range"
              className={styles.range}
              min={5}
              max={50}
              step={5}
              value={newsMaxPerFeed}
              onChange={(e) => setNewsMaxPerFeed(Number(e.target.value))}
            />
            <div className={styles.rangeLabels}>
              <span>5</span><span>50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Asistente */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Asistente IA</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>System prompt</label>
            <textarea
              className={[styles.input, styles.textarea].join(' ')}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Voz */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Voz (STT / TTS)</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Reconocimiento de voz (STT)</label>
            <div className={styles.segmented}>
              <button
                className={[styles.segment, sttProvider === 'webspeech' ? styles.segmentActive : ''].join(' ')}
                onClick={() => setSttProvider('webspeech')}
              >Web Speech</button>
              <button
                className={[styles.segment, sttProvider === 'groq' ? styles.segmentActive : ''].join(' ')}
                onClick={() => setSttProvider('groq')}
              >Groq Whisper</button>
            </div>
            <span className={styles.fieldHint}>
              Web Speech es nativo y gratuito. Groq Whisper requiere API key de Groq.
            </span>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Lectura en voz alta (TTS)</label>
            <button
              role="switch"
              aria-checked={ttsEnabled}
              className={[styles.toggle, ttsEnabled ? styles.toggleOn : ''].join(' ')}
              onClick={() => setTtsEnabled(!ttsEnabled)}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          {ttsEnabled && spanishVoices.length > 0 && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Voz en español</label>
              <select
                className={styles.select}
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
              >
                <option value="">Por defecto del sistema</option>
                {spanishVoices.map(v => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Info app */}
      <div className={styles.appInfo}>
        <span>Jarvis PWA — v0.1.0</span>
        <span>Datos almacenados en este dispositivo</span>
      </div>
    </div>
  );
}

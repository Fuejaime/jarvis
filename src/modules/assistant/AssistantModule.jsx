import { useState, useRef, useEffect, useCallback } from 'react';
import { useLLM } from '../../hooks/useLLM.js';
import { useSTT } from '../../hooks/useSTT.js';
import { useTTS } from '../../hooks/useTTS.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { saveChat, getChats } from '../../services/db.js';
import styles from './AssistantModule.module.css';

/**
 * AssistantModule — Chat con el asistente IA.
 *
 * Características:
 *  - Streaming de respuestas
 *  - Entrada por voz (STT)
 *  - Lectura en voz alta (TTS)
 *  - Historial de sesiones (IndexedDB)
 */
export default function AssistantModule() {
  const { sendMessage, abort, streaming, error: llmError, getActiveProviderConfig } = useLLM();
  const { startListening, stopListening, listening, transcript, supported: sttSupported } = useSTT();
  const { speak, stop: stopTTS, speaking } = useTTS();
  const { keyboardHeight } = useKeyboard();

  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [sessionId,    setSessionId]    = useState(() => Date.now().toString());
  const [showHistory,  setShowHistory]  = useState(false);
  const [history,     setHistory]       = useState([]);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const streamBuf  = useRef('');

  const providerCfg = getActiveProviderConfig();

  // Scroll al final cuando lleguen nuevos mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Si el STT produce un transcript, volcarlo en el input
  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  // ─── Enviar mensaje ───────────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || streaming) return;

    setInput('');
    stopTTS();

    const userMsg = { role: 'user', content, id: Date.now() };
    const assistantMsg = { role: 'assistant', content: '', id: Date.now() + 1, streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    streamBuf.current = '';

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const fullText = await sendMessage(history, (delta) => {
        streamBuf.current += delta;
        setMessages(prev =>
          prev.map(m => m.id === assistantMsg.id
            ? { ...m, content: streamBuf.current }
            : m
          )
        );
      });

      // Marcar streaming como terminado
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id
          ? { ...m, content: fullText || streamBuf.current, streaming: false }
          : m
        )
      );

      // Persistir sesión en IndexedDB
      const updatedMessages = [
        ...messages,
        userMsg,
        { role: 'assistant', content: fullText || streamBuf.current, id: assistantMsg.id },
      ];
      await saveChat({
        id:        sessionId,
        messages:  updatedMessages,
        createdAt: new Date().toISOString(),
        title:     updatedMessages[0]?.content?.slice(0, 60) || 'Sin título',
      });
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id
          ? { ...m, content: '[Error al obtener respuesta]', streaming: false, error: true }
          : m
        )
      );
    }
  }, [input, messages, streaming, sendMessage, sessionId, stopTTS]);

  // ─── Historial ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    const chats = await getChats(20);
    setHistory(chats);
    setShowHistory(true);
  }, []);

  const loadSession = useCallback((chat) => {
    setMessages(chat.messages);
    setSessionId(chat.id);
    setShowHistory(false);
  }, []);

  const newSession = useCallback(() => {
    setMessages([]);
    setSessionId(Date.now().toString());
    setShowHistory(false);
  }, []);

  // ─── Voz ──────────────────────────────────────────────────────────────────
  const handleVoice = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening((text) => handleSend(text));
    }
  }, [listening, startListening, stopListening, handleSend]);

  // ─── Vista: historial ─────────────────────────────────────────────────────
  if (showHistory) {
    return (
      <div className={styles.view}>
        <header className={styles.header}>
          <button className={styles.iconBtn} onClick={() => setShowHistory(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h1 className={styles.headerTitle}>Historial</h1>
          <button className={styles.newBtn} onClick={newSession}>Nueva sesión</button>
        </header>
        <ul className={styles.historyList}>
          {history.length === 0 && (
            <li className={styles.emptyHistory}>No hay sesiones guardadas.</li>
          )}
          {history.map(chat => (
            <li key={chat.id}>
              <button className={styles.historyItem} onClick={() => loadSession(chat)}>
                <span className={styles.historyTitle}>{chat.title || 'Sin título'}</span>
                <span className={styles.historyDate}>
                  {new Date(chat.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ─── Vista principal: chat ────────────────────────────────────────────────
  return (
    <div
      className={styles.view}
      style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
    >
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>
          Jarvis
          {providerCfg && (
            <span className={styles.providerBadge}>
              {providerCfg.id} · {providerCfg.model}
            </span>
          )}
        </h1>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={loadHistory} aria-label="Historial">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z"/>
            </svg>
          </button>
          {messages.length > 0 && (
            <button className={styles.iconBtn} onClick={newSession} aria-label="Nueva sesión">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Sin provider configurado */}
      {!providerCfg && (
        <div className={styles.noProvider}>
          <p>No hay ningún provider IA habilitado.</p>
          <p>Ve a <strong>Ajustes → Proveedores</strong> y configura uno.</p>
        </div>
      )}

      {/* Mensajes */}
      <div className={styles.messages}>
        {messages.length === 0 && providerCfg && (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <p>Hola, soy Jarvis. ¿En qué puedo ayudarte?</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onSpeak={(text) => speak(text)}
            onStopSpeak={stopTTS}
            speaking={speaking}
          />
        ))}

        {llmError && (
          <div className={styles.errorBanner} role="alert">{llmError}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className={styles.inputBar}>
        {sttSupported && (
          <button
            className={[styles.voiceBtn, listening ? styles.voiceBtnActive : ''].join(' ')}
            onClick={handleVoice}
            aria-label={listening ? 'Detener grabación' : 'Grabar mensaje de voz'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
            </svg>
          </button>
        )}

        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Auto-resize
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={listening ? 'Escuchando...' : 'Escribe un mensaje...'}
          rows={1}
          disabled={listening}
        />

        {streaming ? (
          <button className={styles.sendBtn} onClick={abort} aria-label="Cancelar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={() => handleSend()}
            disabled={!input.trim() || !providerCfg}
            aria-label="Enviar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, onSpeak, onStopSpeak, speaking }) {
  const isUser = msg.role === 'user';

  return (
    <div className={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant, msg.error ? styles.bubbleError : ''].join(' ')}>
      <div className={styles.bubbleContent}>
        {/* Render simple del texto — para markdown completo añadir marked */}
        <span className={styles.bubbleText}>{msg.content}</span>
        {msg.streaming && <span className={styles.cursor} aria-hidden />}
      </div>

      {!isUser && !msg.streaming && msg.content && (
        <button
          className={styles.speakBtn}
          onClick={() => speaking ? onStopSpeak() : onSpeak(msg.content)}
          aria-label={speaking ? 'Detener' : 'Escuchar'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {speaking
              ? <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
              : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
            }
          </svg>
        </button>
      )}
    </div>
  );
}

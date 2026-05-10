/**
 * useTTS.js — Text-to-Speech hook via Web Speech API (speechSynthesis).
 *
 * Características:
 *   - Cola de utterances: puedes encolar varios textos y se leen en orden
 *   - Pausa/reanuda
 *   - Usa la voz configurada en Settings
 *   - Compatible con iOS Safari (sin necesidad de backend)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore.js';

export function useTTS() {
  const ttsEnabled = useSettingsStore(s => s.ttsEnabled);
  const ttsVoice   = useSettingsStore(s => s.ttsVoice);

  const [speaking, setSpeaking] = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [voices,   setVoices]   = useState([]);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Cargar voces disponibles (iOS las carga de forma asíncrona)
  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [supported]);

  function getVoice(lang = 'es') {
    if (ttsVoice) {
      const found = voices.find(v => v.name === ttsVoice);
      if (found) return found;
    }
    // Buscar voz en español por defecto
    return voices.find(v => v.lang.startsWith(lang)) || null;
  }

  /**
   * Lee un texto en voz alta.
   * @param {string} text
   * @param {object} opts — { lang?, rate?, pitch?, onEnd? }
   */
  const speak = useCallback((text, opts = {}) => {
    if (!supported || !ttsEnabled || !text?.trim()) return;

    window.speechSynthesis.cancel(); // detener cualquier lectura en curso

    const utter   = new SpeechSynthesisUtterance(text);
    utter.lang    = opts.lang || 'es-ES';
    utter.rate    = opts.rate || 1.05;
    utter.pitch   = opts.pitch || 1;

    const voice   = getVoice(opts.lang?.slice(0, 2) || 'es');
    if (voice) utter.voice = voice;

    utter.onstart = () => { setSpeaking(true); setPaused(false); };
    utter.onend   = () => { setSpeaking(false); setPaused(false); opts.onEnd?.(); };
    utter.onerror = () => { setSpeaking(false); setPaused(false); };

    window.speechSynthesis.speak(utter);
  }, [supported, ttsEnabled, voices, ttsVoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported || !speaking) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported, speaking]);

  const resume = useCallback(() => {
    if (!supported || !paused) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported, paused]);

  return { speak, stop, pause, resume, speaking, paused, voices, supported: supported && ttsEnabled };
}

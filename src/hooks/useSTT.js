/**
 * useSTT.js — Speech-to-Text hook.
 *
 * Estrategia:
 *   1. Web Speech API (nativo iOS/Safari) — gratuito, sin latencia
 *   2. Fallback: Groq Whisper API (si el proveedor Groq está configurado)
 *
 * Devuelve:
 *   - startListening(): inicia grabación
 *   - stopListening(): detiene y obtiene transcripción
 *   - listening: boolean
 *   - transcript: string (resultado final)
 *   - error: string | null
 *   - supported: boolean
 */

import { useState, useCallback, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore.js';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export function useSTT() {
  const sttProvider = useSettingsStore(s => s.sttProvider);
  const providers   = useSettingsStore(s => s.providers);

  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error,      setError]      = useState(null);

  const recognitionRef  = useRef(null);
  const mediaRecRef     = useRef(null);
  const chunksRef       = useRef([]);
  const onResultRef     = useRef(null);

  const supported = !!SpeechRecognition || sttProvider === 'groq';

  // ─── Web Speech API ────────────────────────────────────────────────────────

  function startWebSpeech(onFinal) {
    if (!SpeechRecognition) { setError('Web Speech API no disponible'); return; }

    const rec          = new SpeechRecognition();
    rec.lang           = 'es-ES';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous     = false;

    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const text   = result[0].transcript;
      setTranscript(text);
      if (result.isFinal) {
        onFinal?.(text);
      }
    };

    rec.onerror = (e) => {
      setError(e.error === 'no-speech' ? 'No se detectó voz' : `Error STT: ${e.error}`);
      setListening(false);
    };

    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stopWebSpeech() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }

  // ─── Groq Whisper fallback ─────────────────────────────────────────────────

  async function startGroqRecording(onFinal) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Micrófono no disponible');
      return;
    }

    try {
      const stream    = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRec  = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mediaRec.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob      = new Blob(chunksRef.current, { type: 'audio/webm' });
        const text      = await transcribeGroq(blob);
        setTranscript(text);
        setListening(false);
        onFinal?.(text);
      };

      mediaRecRef.current = mediaRec;
      mediaRec.start();
      setListening(true);
    } catch (err) {
      setError(`Micrófono: ${err.message}`);
    }
  }

  async function transcribeGroq(blob) {
    const groqKey = providers?.groq?.apiKey;
    if (!groqKey) throw new Error('Configura la API key de Groq para STT de respaldo');

    const form = new FormData();
    form.append('file',  blob, 'audio.webm');
    form.append('model', 'whisper-large-v3');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body:    form,
    });

    if (!res.ok) throw new Error(`Groq Whisper error: ${res.status}`);
    const data = await res.json();
    return data.text || '';
  }

  function stopGroqRecording() {
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop();
    }
  }

  // ─── API pública ───────────────────────────────────────────────────────────

  const startListening = useCallback((onFinal) => {
    setError(null);
    setTranscript('');
    onResultRef.current = onFinal;

    if (sttProvider === 'groq') {
      startGroqRecording(onFinal);
    } else {
      startWebSpeech(onFinal);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttProvider, providers]);

  const stopListening = useCallback(() => {
    if (sttProvider === 'groq') {
      stopGroqRecording();
    } else {
      stopWebSpeech();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttProvider]);

  return { startListening, stopListening, listening, transcript, error, supported };
}

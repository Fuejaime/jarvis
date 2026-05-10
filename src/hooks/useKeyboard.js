/**
 * useKeyboard.js
 *
 * Detecta si el teclado virtual está abierto en iOS PWA usando la
 * visualViewport API.
 *
 * Problema con el enfoque anterior: en iOS PWA standalone, window.innerHeight
 * también se reduce dinámicamente cuando el teclado abre, haciendo que
 * (window.innerHeight - visualViewport.height) ≈ 0 siempre.
 *
 * Solución: capturar vv.height al montar como "base height" y comparar
 * contra ese valor fijo en cada resize.
 *
 * Returns: { keyboardOpen: boolean, keyboardHeight: number }
 */
import { useState, useEffect, useRef } from 'react';

const KEYBOARD_THRESHOLD = 120; // px — diferencia mínima para considerar teclado abierto

export function useKeyboard() {
  const [keyboardOpen,   setKeyboardOpen]   = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const baseHeightRef = useRef(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Capturamos la altura inicial ANTES de que ningún teclado abra
    baseHeightRef.current = vv.height;

    function update() {
      const base    = baseHeightRef.current;
      const current = vv.height;
      const hidden  = base - current;
      const open    = hidden > KEYBOARD_THRESHOLD;

      setKeyboardOpen(open);
      setKeyboardHeight(open ? hidden : 0);

      // Actualizar base cuando el teclado se cierra (cubre cambios de orientación)
      if (!open) {
        baseHeightRef.current = current;
      }
    }

    vv.addEventListener('resize', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
    };
  }, []);

  return { keyboardOpen, keyboardHeight };
}

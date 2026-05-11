/**
 * useKeyboard.js
 *
 * Detecta si el teclado virtual está abierto en iOS PWA usando la
 * visualViewport API.
 *
 * Problema en iOS PWA standalone: window.innerHeight también se reduce cuando
 * el teclado abre, haciendo que (window.innerHeight - visualViewport.height) ≈ 0.
 *
 * Solución: capturar vv.height al montar como "base height" y comparar contra
 * ese valor fijo en cada resize.
 *
 * Returns:
 *   keyboardOpen   — boolean: si el teclado está abierto
 *   keyboardHeight — number:  altura del teclado en px
 *   vpHeight       — number:  altura actual del visual viewport (excluye teclado)
 *   vpOffsetTop    — number:  desplazamiento que iOS aplica al layout viewport
 *                             al enfocar inputs (normalmente 0)
 */
import { useState, useEffect, useRef } from 'react';

const KEYBOARD_THRESHOLD = 120; // px — diferencia mínima para considerar teclado abierto

export function useKeyboard() {
  const [keyboardOpen,   setKeyboardOpen]   = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [vpHeight,       setVpHeight]       = useState(
    () => window.visualViewport?.height ?? window.innerHeight
  );
  const [vpOffsetTop,    setVpOffsetTop]    = useState(0);

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
      setVpHeight(current);
      setVpOffsetTop(vv.offsetTop);

      // Actualizar base cuando el teclado se cierra (cubre cambios de orientación)
      if (!open) {
        baseHeightRef.current = current;
      }
    }

    // resize: teclado abre/cierra
    // scroll: iOS desplaza el layout viewport al enfocar inputs
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return { keyboardOpen, keyboardHeight, vpHeight, vpOffsetTop };
}

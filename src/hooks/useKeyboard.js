/**
 * useKeyboard.js
 *
 * Detecta si el teclado virtual está abierto en iOS (y Android) usando la
 * visualViewport API. Cuando el teclado sube, visualViewport.height se reduce
 * significativamente respecto a window.innerHeight.
 *
 * Returns: { keyboardOpen: boolean, keyboardHeight: number }
 */
import { useState, useEffect } from 'react';

const KEYBOARD_THRESHOLD = 120; // px — diferencia mínima para considerar teclado abierto

export function useKeyboard() {
  const [keyboardOpen,   setKeyboardOpen]   = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // SSR / navegadores sin soporte

    function update() {
      // visibleBottom = posición del borde inferior del área visible desde el top del layout
      const visibleBottom = vv.offsetTop + vv.height;
      const hidden        = window.innerHeight - visibleBottom; // píxeles tapados por el teclado
      const open          = hidden > KEYBOARD_THRESHOLD;

      setKeyboardOpen(open);
      setKeyboardHeight(open ? hidden : 0);
    }

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update(); // estado inicial

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return { keyboardOpen, keyboardHeight };
}

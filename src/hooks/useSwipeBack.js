/**
 * useSwipeBack — Detecta swipe desde el borde izquierdo de la pantalla
 * para navegar hacia atrás, como el gesto nativo de iOS.
 *
 * Uso:
 *   const swipeProps = useSwipeBack(handleBack);
 *   <div {...swipeProps}>...</div>
 */

import { useRef, useCallback } from 'react';

const EDGE_ZONE    = 44;  // px desde el borde izquierdo para activar el gesto
const MIN_DISTANCE = 80;  // px mínimos de desplazamiento horizontal para disparar back

export function useSwipeBack(onBack, enabled = true) {
  const startRef     = useRef(null);
  const triggeredRef = useRef(false);

  const onTouchStart = useCallback((e) => {
    if (!enabled) return;
    const touch = e.touches[0];
    // Solo activar si el dedo empieza en el borde izquierdo
    if (touch.clientX > EDGE_ZONE) return;
    startRef.current  = { x: touch.clientX, y: touch.clientY };
    triggeredRef.current = false;
  }, [enabled]);

  const onTouchEnd = useCallback((e) => {
    if (!startRef.current || !enabled || triggeredRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = Math.abs(touch.clientY - startRef.current.y);
    startRef.current = null;

    // Swipe horizontal hacia la derecha con drift vertical mínimo
    if (dx > MIN_DISTANCE && dy < dx * 0.7) {
      triggeredRef.current = true;
      onBack();
    }
  }, [onBack, enabled]);

  const onTouchCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}

/**
 * usePullToRefresh
 *
 * Detecta el gesto de "tirar hacia abajo para actualizar" sobre un elemento.
 * Devuelve un ref que debe asignarse al contenedor donde se quiere detectar
 * el gesto y el estado de la animación.
 *
 * Notas iOS:
 *  - Usa { passive: false } en touchmove para poder llamar preventDefault()
 *    y evitar que el scroll container padre se mueva mientras se hace pull.
 *  - Solo activa el gesto cuando el scroll del contenedor padre está en 0.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const PULL_THRESHOLD = 72;    // px para disparar el refresh
const PULL_MAX       = 96;    // px máximos de desplazamiento visual
const PULL_RESISTANCE = 0.45; // factor de resistencia (sensación física)

export function usePullToRefresh(onRefresh, enabled = true) {
  const [pullDistance, setPullDistance]   = useState(0);
  const [isTriggered,  setIsTriggered]    = useState(false);
  const [isRefreshing, setIsRefreshing]   = useState(false);

  const containerRef     = useRef(null);
  const startYRef        = useRef(null);
  const pullDistanceRef  = useRef(0);
  const isRefreshingRef  = useRef(false);
  const onRefreshRef     = useRef(onRefresh);
  const enabledRef       = useRef(enabled);

  // Mantener refs actualizadas sin re-crear los listeners
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { enabledRef.current   = enabled;   }, [enabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    /** Encuentra el primer ancestro con overflow scroll/auto */
    function getScrollContainer() {
      let parent = el.parentElement;
      while (parent) {
        const { overflowY } = getComputedStyle(parent);
        if (overflowY === 'auto' || overflowY === 'scroll') return parent;
        parent = parent.parentElement;
      }
      return null;
    }

    function onTouchStart(e) {
      if (!enabledRef.current || isRefreshingRef.current) return;
      const scrollEl = getScrollContainer();
      if (scrollEl && scrollEl.scrollTop > 5) return; // no en medio del scroll
      startYRef.current = e.touches[0].clientY;
    }

    function onTouchMove(e) {
      if (startYRef.current === null) return;

      const dy = e.touches[0].clientY - startYRef.current;

      if (dy <= 0) {
        // El usuario está scrolleando hacia arriba — cancelar pull
        startYRef.current    = null;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        setIsTriggered(false);
        return;
      }

      // Prevenir el scroll del contenedor padre mientras hacemos pull
      e.preventDefault();

      const distance = Math.min(dy * PULL_RESISTANCE, PULL_MAX);
      pullDistanceRef.current = distance;
      setPullDistance(distance);
      setIsTriggered(distance >= PULL_THRESHOLD);
    }

    async function onTouchEnd() {
      if (startYRef.current === null && pullDistanceRef.current === 0) return;
      startYRef.current = null;

      const dist = pullDistanceRef.current;
      pullDistanceRef.current = 0;

      if (dist >= PULL_THRESHOLD && !isRefreshingRef.current) {
        // Mantener el indicador visible durante el refresh
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(Math.round(PULL_THRESHOLD * 0.7)); // posición de espera

        try {
          await onRefreshRef.current();
        } finally {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          setPullDistance(0);
          setIsTriggered(false);
        }
      } else {
        // No llegó al umbral → retroceder
        setPullDistance(0);
        setIsTriggered(false);
      }
    }

    el.addEventListener('touchstart',  onTouchStart,  { passive: true  });
    el.addEventListener('touchmove',   onTouchMove,   { passive: false });
    el.addEventListener('touchend',    onTouchEnd,    { passive: true  });
    el.addEventListener('touchcancel', onTouchEnd,    { passive: true  });

    return () => {
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []); // solo al montar — los callbacks usan refs

  return { containerRef, pullDistance, isTriggered, isRefreshing };
}

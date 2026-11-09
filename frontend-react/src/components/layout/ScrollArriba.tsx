import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Cada vista arranca arriba de todo (pedido del cliente, nov 2026): al cambiar
// de ruta se vuelve al tope, también con atrás/adelante del navegador.
// Con un #ancla (ej. /perfil#compras) no se toca: la página baja sola hasta
// esa sección. Los cambios de ?página=2 tampoco cuentan (no cambia la ruta).
export default function ScrollArriba() {
  const { pathname, hash } = useLocation();

  // Que el navegador no restaure la posición vieja al volver atrás
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useLayoutEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

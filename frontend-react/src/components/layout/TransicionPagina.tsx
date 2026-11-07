import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './TransicionPagina.module.scss';

// Al pasar de una sección a otra se muestra la misma pantalla del logo que
// al cargar la web (index.html → #splash), durante MINIMO_MS, con fundido.
// Solo cuando cambia la ruta (no con ?página=2 ni #anclas) y no en la
// primera carga, que ya tiene su propia pantalla.
const MINIMO_MS = 500;
const FUNDIDO_MS = 250;

export default function TransicionPagina() {
  const { pathname } = useLocation();
  const primera = useRef(true);
  const [estado, setEstado] = useState<'oculta' | 'visible' | 'saliendo'>('oculta');

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setEstado('visible');
    const salir = setTimeout(() => setEstado('saliendo'), MINIMO_MS);
    const ocultar = setTimeout(() => setEstado('oculta'), MINIMO_MS + FUNDIDO_MS);
    return () => {
      clearTimeout(salir);
      clearTimeout(ocultar);
    };
  }, [pathname]);

  if (estado === 'oculta') return null;
  return (
    <div className={`${styles.pantalla} ${estado === 'saliendo' ? styles.saliendo : ''}`} aria-hidden="true">
      <img src="/assets/figma/logo-oscuro.svg" alt="" width={217} height={22} />
    </div>
  );
}

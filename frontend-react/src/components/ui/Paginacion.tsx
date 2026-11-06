import { useMemo } from 'react';
import styles from './Paginacion.module.scss';

// Paginador del rediseño: "1 2 3 … 9  Siguiente →" con la página actual
// subrayada. Lo usan Todas las subastas y el Catálogo de bienes (las páginas
// vienen del backend). Se oculta solo si hay una sola página.

interface Props {
  pagina: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
  /** Para lectores de pantalla, ej. "Páginas de subastas" */
  etiqueta: string;
  className?: string;
}

/** Números a mostrar: siempre la 1, la última y 2 a cada lado de la actual; "…" en los huecos. */
function numerosVisibles(actual: number, total: number): (number | '…')[] {
  const delta = 2;
  const rango: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= actual - delta && i <= actual + delta) || i <= 3) rango.push(i);
  }
  const conPuntos: (number | '…')[] = [];
  let anterior: number | undefined;
  for (const i of rango) {
    if (anterior) {
      if (i - anterior === 2) conPuntos.push(anterior + 1);
      else if (i - anterior !== 1) conPuntos.push('…');
    }
    conPuntos.push(i);
    anterior = i;
  }
  return conPuntos;
}

export default function Paginacion({ pagina, totalPaginas, onCambiar, etiqueta, className }: Props) {
  const numeros = useMemo(() => numerosVisibles(pagina, totalPaginas), [pagina, totalPaginas]);
  if (totalPaginas <= 1) return null;

  const ir = (p: number) => {
    if (p >= 1 && p <= totalPaginas && p !== pagina) onCambiar(p);
  };

  return (
    <nav className={`${styles.paginacion} ${className ?? ''}`} aria-label={etiqueta}>
      {numeros.map((p, i) =>
        p === '…' ? (
          <span key={`puntos-${i}`} className={styles.puntos}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={p === pagina ? styles.actual : undefined}
            aria-current={p === pagina ? 'page' : undefined}
            onClick={() => ir(p)}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={styles.siguiente} onClick={() => ir(pagina + 1)} disabled={pagina === totalPaginas}>
        Siguiente →
      </button>
    </nav>
  );
}

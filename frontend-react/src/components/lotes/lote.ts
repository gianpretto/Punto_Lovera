// Forma en la que la tarjeta de lote y el visor reciben un lote del catálogo.
export interface LoteCatalogo {
  id: string;
  numero: number;
  /** "12" o "12 BIS" (lote agregado a último momento con el mismo número) */
  numeroTexto: string;
  titulo: string;
  /** Primer párrafo de la descripción (en la tarjeta y en negrita en el visor) */
  resumen: string;
  /** Resto de los párrafos de la descripción (solo en el visor) */
  detalle: string[];
  /** Texto chico de la derecha ("SIN BASE" o "VENDIDO") */
  etiqueta: string;
  imagenes: string[];
}

/** Separa la descripción en párrafos (por líneas en blanco). */
export function partirDescripcion(descripcion: string): { resumen: string; detalle: string[] } {
  const parrafos = descripcion
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { resumen: parrafos[0] ?? '', detalle: parrafos.slice(1) };
}

/** "12" o "12 BIS" */
export const textoNumeroLote = (numero: number, bis?: boolean) => `${numero}${bis ? ' BIS' : ''}`;

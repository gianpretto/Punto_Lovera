// Forma en la que la tarjeta de lote y el visor reciben un lote del catálogo.
export interface LoteCatalogo {
  id: string;
  numero: number;
  titulo: string;
  /** Primer párrafo de la descripción (en la tarjeta y en negrita en el visor) */
  resumen: string;
  /** Resto de los párrafos de la descripción (solo en el visor) */
  detalle: string[];
  /** Texto chico de la derecha ("BASE $ 150.000" o "VENDIDO") */
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

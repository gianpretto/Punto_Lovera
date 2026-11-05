import styles from './EstadoPastilla.module.scss';

// Pastilla de estado (comprobantes, reintegros), en la línea de la pastilla
// "ACTIVA" de TarjetaSubasta: rectangular, mayúsculas chicas.
//  - PENDIENTE: gris claro   - APROBADO: verde claro   - RECHAZADO: rojo suave
export type EstadoTramite = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

interface Props {
  estado: EstadoTramite;
  /** Texto visible (p. ej. "En revisión", "Acreditado") */
  children: string;
  className?: string;
}

export default function EstadoPastilla({ estado, children, className }: Props) {
  return <span className={[styles.pastilla, styles[estado], className ?? ''].join(' ')}>{children}</span>;
}

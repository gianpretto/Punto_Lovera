import styles from './Etiqueta.module.scss';

// Etiqueta de sección del diseño: una línea de 43 px y el texto en
// mayúsculas ("—— AGENDA", "—— PREGUNTAS FRECUENTES").
//  - tamaño 'chica': 12/13 bold (AGENDA, HABLEMOS)
//  - tamaño 'grande': 24/27 bold (PREGUNTAS FRECUENTES)
interface Props {
  children: string;
  /** Color sobre fondo oscuro (blanco) o claro (#2e2d2b) */
  tono?: 'claro' | 'oscuro';
  tamano?: 'chica' | 'grande';
  className?: string;
}

export default function Etiqueta({ children, tono = 'oscuro', tamano = 'chica', className }: Props) {
  return (
    <p className={[styles.etiqueta, styles[tono], styles[tamano], className ?? ''].join(' ')}>
      <span className={styles.linea} aria-hidden="true" />
      {children}
    </p>
  );
}

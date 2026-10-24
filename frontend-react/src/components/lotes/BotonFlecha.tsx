import styles from './BotonFlecha.module.scss';

// Botón circular blanco de 34 px con un chevrón verde (anterior / siguiente
// foto), igual en la tarjeta de lote y en el visor.
interface Props {
  direccion: 'anterior' | 'siguiente';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export default function BotonFlecha({ direccion, onClick, className }: Props) {
  return (
    <button
      type="button"
      className={[styles.flecha, className ?? ''].join(' ')}
      onClick={onClick}
      aria-label={direccion === 'anterior' ? 'Foto anterior' : 'Foto siguiente'}
    >
      <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
        <path
          d={direccion === 'anterior' ? 'M6 1.5 1.8 7 6 12.5' : 'M2 1.5 6.2 7 2 12.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

import { useState } from 'react';
import BotonFlecha from './BotonFlecha';
import type { LoteCatalogo } from './lote';
import styles from './TarjetaLote.module.scss';

// Tarjeta de lote del catálogo (Figma "catalogo", 413 x 576): foto de 289 px
// con flechas para pasar las fotos, "LOTE N" + etiqueta, título serif,
// resumen y el botón "Ver lote" que abre el visor (VisorLote).
interface Props {
  lote: LoteCatalogo;
  /** Abre el visor en la foto indicada */
  onVerFotos: (foto: number) => void;
  /** Favoritos (solo con sesión): si no viene, no se muestra el corazón */
  favorito?: boolean;
  onFavorito?: () => void;
}

export default function TarjetaLote({ lote, onVerFotos, favorito = false, onFavorito }: Props) {
  const [foto, setFoto] = useState(0);
  const total = lote.imagenes.length;
  const varias = total > 1;

  const mover = (paso: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setFoto((i) => (i + paso + total) % total);
  };

  return (
    <article className={styles.tarjeta} aria-labelledby={`lote-${lote.id}`}>
      <div className={styles.media}>
        {total > 0 ? (
          <button
            type="button"
            className={styles.fotoBoton}
            onClick={() => onVerFotos(foto)}
            aria-label={`Ver el lote ${lote.titulo}`}
          >
            <img className={styles.foto} src={lote.imagenes[foto]} alt="" loading="lazy" />
          </button>
        ) : (
          <span className={styles.sinFotos}>Sin fotos todavía</span>
        )}

        {varias && (
          <>
            <BotonFlecha direccion="anterior" onClick={mover(-1)} className={styles.flechaIzq} />
            <BotonFlecha direccion="siguiente" onClick={mover(1)} className={styles.flechaDer} />
          </>
        )}

        {onFavorito && (
          <button
            type="button"
            className={`${styles.favorito} ${favorito ? styles.favoritoActivo : ''}`}
            onClick={onFavorito}
            aria-pressed={favorito}
            aria-label={favorito ? `Quitar ${lote.titulo} de favoritos` : `Agregar ${lote.titulo} a favoritos`}
            title={favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 21s-7.5-4.6-9.5-9.2C1.1 8.5 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5c3.4 0 5.5 3.5 4.1 6.8C19.5 16.4 12 21 12 21z"
                fill={favorito ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div className={styles.cuerpo}>
        <p className={styles.etiquetas}>
          <span className={styles.numero}>LOTE {lote.numeroTexto}</span>
          {lote.etiqueta && <span>{lote.etiqueta}</span>}
        </p>
        <h3 id={`lote-${lote.id}`} className={styles.titulo}>
          {lote.titulo}
        </h3>
        <p className={styles.resumen}>{lote.resumen}</p>
      </div>

      <button type="button" className={styles.verLote} onClick={() => onVerFotos(foto)}>
        <span>Ver lote</span>
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

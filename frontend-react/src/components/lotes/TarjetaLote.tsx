import { useState } from 'react';
import BotonFlecha from './BotonFlecha';
import type { LoteCatalogo } from './lote';
import styles from './TarjetaLote.module.scss';

// Tarjeta de lote del catálogo (Figma "catalogo", 413 x 576): foto de 289 px
// con flechas para pasar las fotos, "LOTE N" + etiqueta, título serif,
// resumen y "Ver fotos →" que abre el visor (VisorLote).
interface Props {
  lote: LoteCatalogo;
  /** Abre el visor en la foto indicada */
  onVerFotos: (foto: number) => void;
}

export default function TarjetaLote({ lote, onVerFotos }: Props) {
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
            aria-label={`Ampliar fotos de ${lote.titulo}`}
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
      </div>

      <div className={styles.cuerpo}>
        <p className={styles.etiquetas}>
          <span>LOTE {lote.numero}</span>
          {lote.etiqueta && <span>{lote.etiqueta}</span>}
        </p>
        <h3 id={`lote-${lote.id}`} className={styles.titulo}>
          {lote.titulo}
        </h3>
        <p className={styles.resumen}>{lote.resumen}</p>
      </div>

      <button type="button" className={styles.verFotos} onClick={() => onVerFotos(foto)}>
        <span>{total > 0 ? 'Ver fotos' : 'Ver detalle'}</span>
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

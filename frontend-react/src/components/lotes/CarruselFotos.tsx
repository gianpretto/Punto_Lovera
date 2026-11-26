import { useRef, useState } from 'react';
import BotonFlecha from './BotonFlecha';
import styles from './CarruselFotos.module.scss';

// Carrusel de fotos del lote en remate (centro de la sala en vivo): flechas,
// deslizar con el dedo y puntos. Tocar la foto abre el visor (VisorLote) en
// esa misma foto, y ahí se sigue pasando. La sala le pone `key` por lote,
// así arranca de la primera foto en cada lote nuevo.

interface Props {
  imagenes: string[];
  titulo: string;
  onAbrir: (foto: number) => void;
}

export default function CarruselFotos({ imagenes, titulo, onAbrir }: Props) {
  const [foto, setFoto] = useState(0);
  const total = imagenes.length;
  const ir = (paso: number) => setFoto((i) => (i + paso + total) % total);
  // Deslizar: dónde empezó el toque
  const inicio = useRef<number | null>(null);
  // Si deslizó, el "click" que sigue no abre el visor
  const deslizo = useRef(false);

  if (total === 0) return <p className={styles.sinFotos}>Sin fotos todavía</p>;

  return (
    <div
      className={styles.carrusel}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') inicio.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (inicio.current === null) return;
        const dx = e.clientX - inicio.current;
        inicio.current = null;
        deslizo.current = Math.abs(dx) > 40;
        if (deslizo.current && total > 1) ir(dx < 0 ? 1 : -1);
      }}
    >
      <button
        type="button"
        className={styles.foto}
        onClick={() => {
          if (deslizo.current) deslizo.current = false;
          else onAbrir(foto);
        }}
        aria-label={`Ampliar foto ${foto + 1} de ${total} de ${titulo}`}
      >
        <img src={imagenes[foto]} alt="" draggable={false} />
      </button>

      {total > 1 && (
        <>
          <BotonFlecha direccion="anterior" onClick={() => ir(-1)} className={styles.flechaIzq} />
          <BotonFlecha direccion="siguiente" onClick={() => ir(1)} className={styles.flechaDer} />
          <div className={styles.puntos}>
            {imagenes.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === foto ? styles.puntoActivo : styles.punto}
                onClick={() => setFoto(i)}
                aria-label={`Foto ${i + 1} de ${total}`}
                aria-current={i === foto}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

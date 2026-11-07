import { useEffect, useRef } from 'react';
import styles from './Home.module.scss';

// "Confían en nosotros": la cinta de logos se mueve sola y además tiene
// flechas para ir y venir. Se pausa con el mouse encima (solo en equipos con
// mouse: en el celular tocarla no la frena) y no se mueve sola si el sistema
// pide reducir movimiento. La cinta tiene dos copias iguales de los logos
// (la segunda oculta para lectores de pantalla) y da la vuelta al llegar a
// la mitad, así el corte no se nota.

export interface Marca {
  src: string;
  alt: string;
  ancho: number;
  alto: number;
}

const VELOCIDAD = 40; // px por segundo
const DURACION_PASO = 450; // ms de la animación de las flechas

export default function CarruselMarcas({ marcas }: { marcas: Marca[] }) {
  const cintaRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const offset = useRef(0);
  const pausado = useRef(false);
  // Paso de las flechas en curso: desde dónde, cuánto y cuándo arrancó
  const paso = useRef<{ desde: number; delta: number; inicio: number } | null>(null);
  const items = [...marcas, ...marcas];

  useEffect(() => {
    const cinta = cintaRef.current;
    if (!cinta) return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let anterior = performance.now();

    const tick = (ahora: number) => {
      const dt = (ahora - anterior) / 1000;
      anterior = ahora;
      const ancho = listaRef.current?.offsetWidth ?? 0;

      if (paso.current) {
        const t = Math.min(1, (ahora - paso.current.inicio) / DURACION_PASO);
        const suave = 1 - (1 - t) ** 3;
        offset.current = paso.current.desde + paso.current.delta * suave;
        if (t === 1) paso.current = null;
      } else if (!pausado.current && !quieto) {
        offset.current += VELOCIDAD * dt;
      }

      if (ancho > 0) offset.current = ((offset.current % ancho) + ancho) % ancho;
      cinta.style.transform = `translateX(${-offset.current}px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const mover = (direccion: 1 | -1) => {
    const ancho = listaRef.current?.offsetWidth ?? 0;
    if (!ancho) return;
    paso.current = { desde: offset.current, delta: (direccion * ancho) / items.length, inicio: performance.now() };
  };

  // Solo con mouse: en pantallas táctiles tocar la cinta no la frena
  const entrar = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') pausado.current = true;
  };
  const salir = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') pausado.current = false;
  };

  return (
    <div className={styles.carruselMarco}>
      <button type="button" className={styles.carruselFlecha} onClick={() => mover(-1)} aria-label="Ver logos anteriores">
        ‹
      </button>
      <div
        className={styles.carrusel}
        onPointerEnter={entrar}
        onPointerLeave={salir}
      >
        <div className={styles.cinta} ref={cintaRef}>
          {[0, 1].map((copia) => (
            <ul
              key={copia}
              ref={copia === 0 ? listaRef : undefined}
              className={styles.marcasLista}
              aria-hidden={copia === 1 || undefined}
            >
              {items.map((m, i) => (
                <li key={i}>
                  <img src={m.src} alt={copia === 0 && i < marcas.length ? m.alt : ''} width={m.ancho} height={m.alto} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <button type="button" className={styles.carruselFlecha} onClick={() => mover(1)} aria-label="Ver logos siguientes">
        ›
      </button>
    </div>
  );
}

import { useState } from 'react';
import type { Faq } from '../../content/participar';
import styles from './PreguntasFrecuentes.module.scss';

// Acordeón de preguntas frecuentes ("ventanitas desplegables" del diagrama).
// Mismo diseño que tenía el bloque FAQ del Home; ahora lo comparten el Home
// y la página /faq.

interface Props {
  items: Faq[];
  titulo?: string;
}

export default function PreguntasFrecuentes({ items, titulo = 'PREGUNTAS FRECUENTES' }: Props) {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section className={styles.faq}>
      <div className={styles.faq__inner}>
        <h2 className={styles.faq__titulo}>{titulo}</h2>

        <div className={styles.faq__lista}>
          {items.map((f, i) => (
            <div className={`${styles.faq__item} ${abierta === i ? styles.activa : ''}`} key={i}>
              <button className={styles.faq__pregunta} onClick={() => setAbierta((a) => (a === i ? null : i))}>
                <span>
                  {i + 1}. {f.pregunta}
                </span>
                <span className={styles.faq__icono}>+</span>
              </button>

              {abierta === i && (
                <div className={styles.faq__respuesta}>
                  <p>{f.respuesta}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

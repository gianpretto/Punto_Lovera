import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Faq } from '../../content/participar';
import Boton from '../ui/Boton';
import Etiqueta from '../ui/Etiqueta';
import styles from './PreguntasFrecuentes.module.scss';

// Bloque "—— PREGUNTAS FRECUENTES / Lo importante, explicado fácil." del
// rediseño (Home y Próximas subastas; también lo usa /faq con todas las
// preguntas). Título a la izquierda y acordeón numerado a la derecha (01.,
// 02., ...) con un chevron verde; arranca con la primera abierta.
//
// El fondo lo pone la página (va sobre el fondo claro con patrón).
interface Props {
  items: Faq[];
  /** Cómo se muestra "¿Tenés otra duda? escribinos →": botón verde (Home) o link subrayado (Próximas) */
  enlace?: 'boton' | 'link';
  className?: string;
}

export default function PreguntasFrecuentes({ items, enlace = 'boton', className }: Props) {
  const [abierta, setAbierta] = useState<number | null>(0);
  const id = useId();

  return (
    <section className={`${styles.faq} ${className ?? ''}`}>
      <div className={styles.contenedor}>
        <div className={styles.columnaTitulo}>
          <Etiqueta tamano="grande">Preguntas frecuentes</Etiqueta>
          <h2 className={styles.titulo}>
            Lo importante, <br />
            <em>explicado fácil.</em>
          </h2>
          {enlace === 'boton' ? (
            <Boton variante="verde" to="/contactanos" flecha className={styles.boton}>
              ¿Tenés otra duda? escribinos
            </Boton>
          ) : (
            <Link className={styles.link} to="/contactanos">
              ¿Tenés otra duda? escribinos <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>

        <ol className={styles.lista}>
          {items.map((f, i) => {
            const abiertaEsta = abierta === i;
            return (
              <li className={styles.item} key={f.pregunta}>
                <button
                  type="button"
                  className={styles.pregunta}
                  aria-expanded={abiertaEsta}
                  aria-controls={`${id}-${i}`}
                  onClick={() => setAbierta((a) => (a === i ? null : i))}
                >
                  <span className={styles.numero}>{String(i + 1).padStart(2, '0')}.</span>
                  <span className={styles.textoPregunta}>{f.pregunta}</span>
                  <svg
                    className={`${styles.chevron} ${abiertaEsta ? styles.chevronAbierto : ''}`}
                    width="22"
                    height="12"
                    viewBox="0 0 22 12"
                    aria-hidden="true"
                  >
                    <path d="M1 1l10 9.5L21 1" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                </button>

                <div id={`${id}-${i}`} className={styles.respuesta} hidden={!abiertaEsta}>
                  <p>{f.respuesta}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

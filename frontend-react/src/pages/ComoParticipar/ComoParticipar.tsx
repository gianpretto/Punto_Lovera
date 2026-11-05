import { Link } from 'react-router-dom';
import Boton from '../../components/ui/Boton';
import Etiqueta from '../../components/ui/Etiqueta';
import { useAuth } from '../../services/AuthContext';
import { pasosParticipar } from '../../content/participar';
import styles from './ComoParticipar.module.scss';

// "Cómo participar" (diagrama: tutorial de pasos → Registrarse). No tiene
// diseño de la diseñadora: sigue la línea de /faq (PreguntasFrecuentes):
// título serif a la izquierda con el botón, y los pasos numerados (01., 02.,
// ...) con líneas verdes a la derecha. Textos: borradores de content/participar.

export default function ComoParticipar() {
  const { user } = useAuth();

  return (
    <div className={styles.pagina}>
      <div className={styles.contenedor}>
        <header className={styles.columnaTitulo}>
          <Etiqueta tamano="grande">Cómo participar</Etiqueta>
          <h1 className={styles.titulo}>
            Seguí estos pasos para ofertar <em>en los remates en vivo.</em>
          </h1>

          {user ? (
            <Boton variante="verde" to="/subastas" flecha className={styles.boton}>
              Ver próximas subastas
            </Boton>
          ) : (
            <Boton variante="verde" to="/registro" flecha className={styles.boton}>
              Registrarse
            </Boton>
          )}
          <Link to="/faq" className={styles.link}>
            Ver preguntas frecuentes <span aria-hidden="true">→</span>
          </Link>
        </header>

        <ol className={styles.pasos}>
          {pasosParticipar.map((p, i) => (
            <li className={styles.paso} key={p.titulo}>
              <span className={styles.numero}>{String(i + 1).padStart(2, '0')}.</span>
              <div>
                <h2 className={styles.pasoTitulo}>{p.titulo}</h2>
                <p className={styles.pasoDesc}>{p.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

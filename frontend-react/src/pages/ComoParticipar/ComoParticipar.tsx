import { Link } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { pasosParticipar } from '../../content/participar';
import styles from './ComoParticipar.module.scss';

// "Cómo participar" (diagrama: tutorial de pasos → Registrarse). En el
// Angular original era un stub; no hay diseño de la diseñadora, sigue la
// estética del sitio (Montserrat, botón negro).

export default function ComoParticipar() {
  const { user } = useAuth();

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.titulo}>CÓMO PARTICIPAR</h1>
        <p className={styles.subtitulo}>Seguí estos pasos para ofertar en los remates en vivo.</p>
      </header>

      <ol className={styles.pasos}>
        {pasosParticipar.map((p, i) => (
          <li className={styles.paso} key={p.titulo}>
            <span className={styles.numero}>{i + 1}</span>
            <div>
              <h3 className={styles.pasoTitulo}>{p.titulo}</h3>
              <p className={styles.pasoDesc}>{p.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.cta}>
        {user ? (
          <Link to="/subastas" className={styles.btnNegro}>
            Ver próximas subastas →
          </Link>
        ) : (
          <Link to="/registro" className={styles.btnNegro}>
            Registrarse →
          </Link>
        )}
        <Link to="/faq" className={styles.link}>
          Ver preguntas frecuentes
        </Link>
      </div>
    </div>
  );
}

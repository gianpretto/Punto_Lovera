import { Link } from 'react-router-dom';
import styles from './Hero.module.scss';

interface HeroProps {
  titulo?: string;
  detalle?: string;
  subtitulo?: string;
  textoBoton?: string;
  linkBoton?: string | null;
  imagenUrl?: string;
}

export default function Hero({
  titulo = 'TITULAR PRINCIPAL',
  detalle = 'detalle',
  subtitulo = '',
  textoBoton = 'Ver más',
  linkBoton = null,
  imagenUrl = '/images/hero-placeholder.jpg',
}: HeroProps) {
  return (
    <section
      className={styles.hero}
      style={{ background: `url(${imagenUrl}) center/cover no-repeat, #919191` }}
    >
      <div className={styles['hero-contenido']}>
        <div className={styles['titulo-wrap']}>
          <h1 className={styles.titulo}>{titulo}</h1>
          <h2 className={styles.detalle}>{detalle}</h2>
        </div>

        <p className={styles.subtitulo}>{subtitulo}</p>

        {linkBoton ? (
          <Link className={styles['btn-primario']} to={linkBoton}>
            {textoBoton}
          </Link>
        ) : (
          <button className={styles['btn-primario']} type="button">
            {textoBoton}
          </button>
        )}
      </div>
    </section>
  );
}

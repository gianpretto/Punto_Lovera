import { Link } from 'react-router-dom';
import styles from './SubastaEnVivo.module.scss';

export default function SubastaEnVivo() {
  return (
    <section className={styles['subasta-envivo-section']}>
      <div className={styles['header-section']}>
        <span className={styles.titulo}>
          SUBASTA ACTIVA • <span className={styles.highlight}>EN VIVO</span>
        </span>
      </div>

      <div className={styles['content-wrapper']}>
        {/* Left Side: Video/Stream Placeholder */}
        <div className={styles['video-container']}>
          <img src="/assets/img/default.png" alt="Subasta en vivo" className={styles['video-bg']} />

          <div className={styles['status-badge']}>
            <span className={styles.text}>ACTIVA</span>
          </div>
          <div className={styles['live-indicator']}>• EN VIVO</div>
        </div>

        {/* Right Side: Info Panel */}
        <div className={styles['info-container']}>
          <h2 className={styles['subasta-titulo']}>
            Heladería con elaboración
            <br />
            máquinas chupetonas
          </h2>
          <p className={styles.ubicacion}>Castelar, Buenos Aires.</p>

          <div className={styles.divider}></div>

          <p className={styles.descripcion}>
            Alguna información relevante o interesante para detallar en un muy breve texto descriptivo, que no dure
            más que esto.
          </p>

          <Link className={styles['btn-unirse']} to="/subastas/1/activa">
            Unirse a la sesión <span className={styles.arrow}>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

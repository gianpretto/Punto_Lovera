import styles from './Redes.module.scss';

export default function Redes() {
  return (
    <section className={styles.redesSection}>
      <div className={styles.redesContainer}>
        <div className={styles.textContent}>
          <h2 className={styles.title}>
            NO TE PIERDAS LAS
            <br />
            PROXIMAS SUBASTAS
          </h2>
          <a href="#" className={styles.followLink}>
            Seguinos <span className={styles.arrow}>→</span>
          </a>
        </div>

        <div className={styles.iconsWrapper}>
          <a href="https://instagram.com/PuntoLovera" className={styles.socialCircle} target="_blank" rel="noreferrer" aria-label="Instagram">
            <img src="/assets/img/instagram.png" alt="Instagram" />
          </a>
          <a href="https://facebook.com/PuntoLovera" className={styles.socialCircle} target="_blank" rel="noreferrer" aria-label="Facebook">
            <img src="/assets/img/facebook.png" alt="Facebook" />
          </a>
          <a href="https://youtube.com/PuntoLovera" className={styles.socialCircle} target="_blank" rel="noreferrer" aria-label="YouTube">
            <img src="/assets/img/youtube.png" alt="YouTube" />
          </a>
        </div>
      </div>
    </section>
  );
}

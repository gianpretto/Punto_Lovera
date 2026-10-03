import { Link } from 'react-router-dom';
import { uploadUrl } from '../../services/api';
import { useAuctions } from '../../services/auctions';
import styles from './SubastaEnVivo.module.scss';

export default function SubastaEnVivo() {
  const activas = useAuctions(['ACTIVA']);
  const subasta = activas?.[0];

  // Sin subasta en vivo no se muestra la sección (mejor que un ejemplo falso)
  if (!subasta) return null;

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
          <img
            src={subasta.coverImageUrl ? uploadUrl(subasta.coverImageUrl) : '/assets/img/default.png'}
            alt="Subasta en vivo"
            className={styles['video-bg']}
          />

          <div className={styles['status-badge']}>
            <span className={styles.text}>ACTIVA</span>
          </div>
          <div className={styles['live-indicator']}>• EN VIVO</div>
        </div>

        {/* Right Side: Info Panel */}
        <div className={styles['info-container']}>
          <h2 className={styles['subasta-titulo']}>{subasta.title}</h2>
          <p className={styles.ubicacion}>{subasta.location}</p>

          <div className={styles.divider}></div>

          <p className={styles.descripcion}>{subasta.description}</p>

          <Link className={styles['btn-unirse']} to={`/subastas/${subasta.id}/activa`}>
            Unirse a la sesión <span className={styles.arrow}>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import styles from './BannerAccion.module.scss';

interface BannerAccionProps {
  type?: 'quiero-comprar' | 'quiero-vender';
}

export default function BannerAccion({ type = 'quiero-comprar' }: BannerAccionProps) {
  const title =
    type === 'quiero-comprar' ? 'REGISTRATE Y EMPEZA A PARTICIPAR' : 'REGISTRATE Y EMPEZA A VENDER';
  const buttonText = type === 'quiero-comprar' ? 'Registrarme →' : 'Contacto';
  const buttonLink = type === 'quiero-comprar' ? '/registro' : '/contacto';

  return (
    <div className={styles.bannerContainer}>
      <h2>{title}</h2>
      <Link to={buttonLink} className={styles.actionBtn}>
        {buttonText}
      </Link>
    </div>
  );
}

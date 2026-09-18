import { Link } from 'react-router-dom';
import styles from './Footer.module.scss';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footer__inner}>
        {/* Logo */}
        <div className={styles.footer__logo}>
          <img src="/assets/img/logo-footer.svg" alt="Punto Lovera" />
        </div>

        {/* Ubicación */}
        <p className={styles.footer__ubicacion}>
          Buenos Aires,
          <br />
          Argentina.
        </p>

        {/* Links */}
        <nav className={styles.footer__links} aria-label="Enlaces del sitio">
          <Link className={styles.nav__link} to="/subastas">
            Próximas subastas
          </Link>
          <Link className={styles.nav__link} to="/quienes-somos">
            Quiénes somos
          </Link>
          <Link className={styles.nav__link} to="/contactanos">
            Contactanos
          </Link>

          <Link className={styles.nav__link_qv} to="/quiero-vender">
            Quiero vender
          </Link>
        </nav>

        {/* Social */}
        <div className={styles.footer__social}>
          <a href="https://instagram.com/PuntoLovera" target="_blank" rel="noopener">
            <img src="/assets/img/instagram.png" alt="Instagram" />
          </a>
          <a href="https://facebook.com/PuntoLovera" target="_blank" rel="noopener">
            <img src="/assets/img/facebook.png" alt="Facebook" />
          </a>
          <a href="https://youtube.com/PuntoLovera" target="_blank" rel="noopener">
            <img src="/assets/img/youtube.png" alt="YouTube" />
          </a>
        </div>

        {/* Mail */}
        <a className={styles.footer__mail} href="mailto:lovera@lovera.com.ar">
          lovera@lovera.com.ar
        </a>

        {/* Badges */}
        <div className={styles.footer__badges}>
          <img src="/assets/img/colegio.png" alt="Colegio Profesional Inmobiliario" />
          <img src="/assets/img/data-fiscal.png" alt="Data Fiscal" />
        </div>
      </div>

      <div className={styles.footer__bottom}>
        <span>Copyright 2025</span>
      </div>
    </footer>
  );
}

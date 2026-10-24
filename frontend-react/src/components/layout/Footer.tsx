import { Link } from 'react-router-dom';
import { REDES } from '../ui/Iconos';
import styles from './Footer.module.scss';

// Footer del rediseño (Figma): fondo #111111 de 427 px con logo, links,
// redes y mail; abajo la ubicación y los sellos; barra de copyright #5a5655.
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.principal}>
        <div className={styles.contenedor}>
          <Link to="/" className={styles.logo} aria-label="Punto Lovera, ir al inicio">
            <img src="/assets/figma/logo-claro.svg" alt="Punto Lovera" width={424} height={41} />
          </Link>

          <nav className={styles.links} aria-label="Enlaces del sitio">
            <Link to="/subastas">Próximas subastas</Link>
            <Link to="/quienes-somos">Quiénes somos</Link>
            <Link to="/contactanos">Contactanos</Link>
            <Link to="/quiero-vender" className={styles.destacado}>
              Quiero vender
            </Link>
          </nav>

          <div className={styles.contacto}>
            <div className={styles.redes}>
              {REDES.map(({ nombre, href, Icono }) => (
                <a key={nombre} href={href} target="_blank" rel="noopener noreferrer" aria-label={nombre}>
                  <Icono size={29} />
                </a>
              ))}
            </div>
            <a className={styles.mail} href="mailto:lovera@lovera.com.ar">
              lovera@lovera.com.ar
            </a>
          </div>

          <p className={styles.ubicacion}>
            Buenos Aires,
            <br />
            Argentina.
          </p>

          <div className={styles.sellos}>
            <img src="/assets/figma/sello-colegio.webp" alt="Colegio Profesional Inmobiliario" width={107} height={50} />
            <img src="/assets/figma/sello-data-fiscal.webp" alt="Data Fiscal" width={46} height={63} />
          </div>
        </div>
      </div>

      <div className={styles.copyright}>Copyright {new Date().getFullYear()}</div>
    </footer>
  );
}

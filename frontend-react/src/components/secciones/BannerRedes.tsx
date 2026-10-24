import { REDES } from '../ui/Iconos';
import styles from './BannerRedes.module.scss';

// Banner "NO TE PIERDAS LAS PROXIMAS SUBASTAS" (Figma: 1064 x 179, radio 20,
// #2e2d2b, círculos verdes de 96 px con los íconos de redes). Va sobre
// fondos oscuros con patrón (Home, Próximas subastas, Contactanos).
export default function BannerRedes() {
  return (
    <div className={styles.banner}>
      <img className={styles.lineas} src="/assets/figma/redes-lineas.svg" alt="" aria-hidden="true" />
      <div className={styles.texto}>
        <p className={styles.titulo}>NO TE PIERDAS LAS PROXIMAS SUBASTAS</p>
        <p className={styles.subtitulo}>Seguinos en nuestras redes sociales.</p>
      </div>
      <div className={styles.redes}>
        {REDES.map(({ nombre, href, Icono }) => (
          <a key={nombre} className={styles.circulo} href={href} target="_blank" rel="noopener noreferrer" aria-label={nombre}>
            <Icono size={48} />
          </a>
        ))}
      </div>
    </div>
  );
}

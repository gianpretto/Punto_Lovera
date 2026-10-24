import { Link } from 'react-router-dom';
import { uploadUrl } from '../../services/api';
import type { AuctionApi } from '../../services/auctions';
import styles from './SubastaDestacada.module.scss';

// Bloque grande de la subasta en vivo (Figma: tarjeta blanca de 1280 x 502,
// foto de 847 px con la cámara del martillero abajo a la derecha y el panel
// de datos con "Unirse a la sesión →"). Lo usan Home y Próximas subastas.
// Si no hay ninguna en vivo, la página pasa la próxima: mismo diseño con
// "PRÓXIMA SUBASTA" y el botón al detalle.

// TODO: el backend todavía no guarda martillero por subasta; nombre y
// matrícula son los del diseño hasta que el cliente pase los reales.
const MARTILLERO = { nombre: 'Lucas Gámez', matricula: '12345 46578 4684' };

const IMAGEN_DEFAULT = '/assets/figma/subasta-cafeteria.webp';

interface Props {
  subasta: AuctionApi;
}

export default function SubastaDestacada({ subasta }: Props) {
  const enVivo = subasta.status === 'ACTIVA';
  const parrafos = subasta.description.split(/\n+/).filter(Boolean);

  return (
    <article className={styles.tarjeta}>
      <div className={styles.media}>
        <img
          className={styles.foto}
          src={subasta.coverImageUrl ? uploadUrl(subasta.coverImageUrl) : IMAGEN_DEFAULT}
          alt={subasta.title}
        />
        {enVivo && (
          <img className={styles.camara} src="/assets/figma/martillero.webp" alt="" width={206} height={145} loading="lazy" />
        )}
      </div>

      <div className={styles.panel}>
        <span className={styles.pastilla}>
          {enVivo ? (
            <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
              <circle cx="11" cy="8" r="2.2" fill="currentColor" />
              <path
                d="M7.2 4.2a5.4 5.4 0 0 0 0 7.6M14.8 4.2a5.4 5.4 0 0 1 0 7.6M4.4 1.4a9.4 9.4 0 0 0 0 13.2M17.6 1.4a9.4 9.4 0 0 1 0 13.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <img src="/assets/figma/icono-martillo-verde.svg" alt="" width={16} height={16} />
          )}
          {enVivo ? 'Subasta en vivo' : 'Próxima subasta'}
        </span>

        <h2 className={styles.titulo}>{subasta.title}</h2>
        <p className={styles.ubicacion}>
          <img src="/assets/figma/icono-ubicacion.svg" alt="" width={14} height={14} />
          {subasta.location}
        </p>
        <div className={styles.descripcion}>
          {parrafos.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className={styles.pie}>
          <p className={styles.martillero}>
            <img src="/assets/figma/icono-martillo-verde.svg" alt="" width={19} height={19} />
            <strong>{MARTILLERO.nombre}</strong>
            <span>Matrícula {MARTILLERO.matricula}</span>
          </p>
          <Link className={styles.boton} to={enVivo ? `/subastas/${subasta.id}/activa` : `/subastas/${subasta.id}`}>
            {enVivo ? 'Unirse a la sesión' : 'Ver la subasta'} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

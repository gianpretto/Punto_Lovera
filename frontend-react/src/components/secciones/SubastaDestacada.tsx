import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { getToken, uploadUrl } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import LivePlayer from '../LivePlayer/LivePlayer';
import type { AuctionApi } from '../../services/auctions';
import { MARTILLEROS } from '../../content/martilleros';
import styles from './SubastaDestacada.module.scss';

// Bloque grande de la subasta en vivo (Figma: tarjeta blanca de 1280 x 502,
// imagen de 847 px y el panel de datos con "Unirse a la sesión →"). Lo usan
// Home y Próximas subastas. Si no hay ninguna en vivo, la página pasa la
// próxima más cercana: mismo diseño con "PRÓXIMA SUBASTA" y el botón al detalle.
// En vivo y con la transmisión prendida, en lugar de la foto va el stream
// (muteado). El video exige sesión (el proxy HLS pide el JWT): sin sesión, o
// mientras no hay señal, se ve la foto de la subasta.


const IMAGEN_DEFAULT = '/assets/figma/subasta-cafeteria.webp';

interface Props {
  subasta: AuctionApi;
}

export default function SubastaDestacada({ subasta }: Props) {
  const { user } = useAuth();
  const enVivo = subasta.status === 'ACTIVA';
  const foto = (
    <img
      className={styles.foto}
      src={subasta.coverImageUrl ? uploadUrl(subasta.coverImageUrl) : IMAGEN_DEFAULT}
      alt={subasta.title}
    />
  );
  const conStream = enVivo && Boolean(subasta.cameraOn) && Boolean(user);
  const parrafos = subasta.description.split(/\n+/).filter(Boolean);

  return (
    <article className={styles.tarjeta}>
      <div className={styles.media}>
        {conStream ? (
          <div className={styles.vivo}>
            <LivePlayer auctionId={subasta.id} camaraPrendida token={getToken()} placeholder={foto} placeholderSinSenal />
          </div>
        ) : (
          foto
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
            {MARTILLEROS.map((m, i) => (
              <Fragment key={m.nombre}>
                {i > 0 && <span className={styles.separador} aria-hidden="true">·</span>}
                <strong>{m.nombre}</strong>
                {m.matricula && <span>Matrícula {m.matricula}</span>}
              </Fragment>
            ))}
          </p>
          <Link className={styles.boton} to={enVivo ? `/subastas/${subasta.id}/activa` : `/subastas/${subasta.id}`}>
            {enVivo ? 'Unirse a la sesión' : 'Ver la subasta'} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

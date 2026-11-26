import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './CamaraVivo.module.scss';

// Muestra un MediaStream (cámara del martillero por WebRTC) en un <video>.
// Los navegadores no dejan reproducir con sonido sin que el usuario haya
// tocado la página: si lo bloquean, arranca sin sonido y con un botón.

interface Props {
  stream: MediaStream | null;
  /** Lo que se ve sin video (cámara apagada) */
  placeholder: ReactNode;
  /** El propio martillero viéndose: siempre sin sonido (si no, se acopla) */
  vistaPrevia?: boolean;
}

export default function CamaraVivo({ stream, placeholder, vistaPrevia = false }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [silenciado, setSilenciado] = useState(vistaPrevia);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.srcObject = stream;
    if (!stream) return;
    v.muted = vistaPrevia;
    v.play().catch(() => {
      // Autoplay con sonido bloqueado: sin sonido y que el usuario lo active
      v.muted = true;
      setSilenciado(true);
      v.play().catch(() => undefined);
    });
  }, [stream, vistaPrevia]);

  const activarSonido = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false;
    setSilenciado(false);
    v.play().catch(() => undefined);
  };

  return (
    <div className={styles.camara}>
      <video ref={video} className={styles.video} playsInline autoPlay muted={silenciado} hidden={!stream} />
      {!stream && placeholder}
      {stream && !vistaPrevia && silenciado && (
        <button type="button" className={styles.sonido} onClick={activarSonido}>
          🔇 Activar sonido
        </button>
      )}
    </div>
  );
}

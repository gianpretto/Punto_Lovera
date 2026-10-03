import { useEffect, useRef, useState, type ReactNode } from 'react';
import Hls from 'hls.js';
import { API_URL } from '../../services/api';
import styles from './LivePlayer.module.scss';

// Video en vivo de una subasta (cámara de rtsp-manager).
//
// No se le pega directo al media server: el backend lo expone por un proxy
// que exige el JWT (GET /api/subastas/:id/vivo/hls/...). Por eso se usa
// hls.js, que permite agregar el header Authorization a cada request
// (playlist y segmentos). El HLS nativo de Safari no deja agregar headers.

interface Props {
  auctionId: string;
  /** null = la subasta no tiene cámara prendida */
  cameraId: string | null;
  token: string | null;
  /** Lo que se muestra cuando no hay video (el placeholder del diseño) */
  placeholder: ReactNode;
}

type Estado = 'cargando' | 'en-vivo' | 'esperando';

const REINTENTO_MS = 4000;

export default function LivePlayer({ auctionId, cameraId, token, placeholder }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<Estado>('cargando');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraId || !token || !Hls.isSupported()) return;

    const src = `${API_URL}/api/subastas/${auctionId}/vivo/hls/index.m3u8`;
    let hls: Hls | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let cancelado = false;

    const arrancar = () => {
      if (cancelado) return;
      setEstado('cargando');
      hls = new Hls({
        lowLatencyMode: true,
        xhrSetup: (xhr) => xhr.setRequestHeader('Authorization', `Bearer ${token}`),
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setEstado('en-vivo');
        video.play().catch(() => {
          // Autoplay bloqueado: arranca muteado (el usuario puede activar el audio)
          video.muted = true;
          video.play().catch(() => undefined);
        });
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        // La cámara recién prendida tarda unos segundos en generar el
        // primer segmento (o se cortó): se reintenta solo.
        setEstado('esperando');
        hls?.destroy();
        hls = null;
        retry = setTimeout(arrancar, REINTENTO_MS);
      });
    };

    arrancar();

    return () => {
      cancelado = true;
      clearTimeout(retry);
      hls?.destroy();
    };
  }, [auctionId, cameraId, token]);

  if (!cameraId) return <>{placeholder}</>;

  if (!token) {
    return (
      <div className={styles.overlayWrapper}>
        {placeholder}
        <div className={styles.overlay}>Iniciá sesión para ver la transmisión en vivo</div>
      </div>
    );
  }

  if (!Hls.isSupported()) {
    return (
      <div className={styles.overlayWrapper}>
        {placeholder}
        <div className={styles.overlay}>Tu navegador no soporta la transmisión en vivo</div>
      </div>
    );
  }

  return (
    <div className={styles.playerWrapper}>
      <video ref={videoRef} className={styles.video} controls playsInline muted />
      {estado !== 'en-vivo' && (
        <div className={styles.overlay}>
          {estado === 'cargando' ? 'Conectando con la cámara...' : 'Esperando la señal de la cámara...'}
        </div>
      )}
      {estado === 'en-vivo' && <span className={styles.badge}>● EN VIVO</span>}
    </div>
  );
}

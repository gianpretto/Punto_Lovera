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
  /** Si la transmisión está habilitada (el backend nunca manda la clave) */
  camaraPrendida: boolean;
  token: string | null;
  /** Pase de invitado: alternativa al token para ver el video */
  pase?: string | null;
  /** Lo que se muestra cuando no hay video (el placeholder del diseño) */
  placeholder: ReactNode;
  /**
   * Mientras no llega la señal, mostrar el placeholder en vez de los avisos
   * "Conectando..." / "Esperando la señal..." (Home: la foto de la subasta)
   */
  placeholderSinSenal?: boolean;
}

type Estado = 'cargando' | 'en-vivo' | 'esperando';

const REINTENTO_MS = 4000;

export default function LivePlayer({
  auctionId,
  camaraPrendida,
  token,
  pase = null,
  placeholder,
  placeholderSinSenal = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Quedó atrás del vivo (pestaña en segundo plano, pausa, corte de red)
  const [atrasado, setAtrasado] = useState(false);

  const irAlVivo = () => {
    const video = videoRef.current;
    const vivo = hlsRef.current?.liveSyncPosition;
    if (!video) return;
    if (vivo != null) video.currentTime = vivo;
    video.play().catch(() => undefined);
    setAtrasado(false);
  };
  const [estado, setEstado] = useState<Estado>('cargando');
  // Arranca muteado (los navegadores bloquean el autoplay con sonido)
  const [muteado, setMuteado] = useState(true);

  const alternarSonido = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuteado(video.muted);
    // Al activar el sonido, saltar al vivo (por si quedó atrás)
    if (!video.muted && video.paused) video.play().catch(() => undefined);
  };

  const pantallaCompleta = () => {
    const el = contenedorRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else el.requestFullscreen?.().catch(() => undefined);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camaraPrendida || !(token || pase) || !Hls.isSupported()) return;

    const src = `${API_URL}/api/subastas/${auctionId}/vivo/hls/index.m3u8`;
    let hls: Hls | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let cancelado = false;

    const arrancar = () => {
      if (cancelado) return;
      setEstado('cargando');
      hls = new Hls({
        // nginx-rtmp genera HLS común (no LL-HLS): ir ~3 segmentos detrás del vivo
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        xhrSetup: (xhr) =>
          token ? xhr.setRequestHeader('Authorization', `Bearer ${token}`) : xhr.setRequestHeader('X-Pase', pase!),
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setEstado('en-vivo');
        video.muted = true;
        setMuteado(true);
        video.play().catch(() => undefined);
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

    // Más de ~8 s detrás del punto "en vivo" (o en pausa) → ofrecer volver
    const revisarAtraso = () => {
      const vivo = hlsRef.current?.liveSyncPosition;
      setAtrasado(video.paused || (vivo != null && vivo - video.currentTime > 8));
    };
    video.addEventListener('timeupdate', revisarAtraso);
    video.addEventListener('pause', revisarAtraso);

    arrancar();

    return () => {
      cancelado = true;
      clearTimeout(retry);
      video.removeEventListener('timeupdate', revisarAtraso);
      video.removeEventListener('pause', revisarAtraso);
      hlsRef.current = null;
      hls?.destroy();
    };
  }, [auctionId, camaraPrendida, token, pase]);

  if (!camaraPrendida) return <>{placeholder}</>;

  if (!token && !pase) {
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
    <div className={styles.playerWrapper} ref={contenedorRef}>
      {/* Sin controles nativos: en vivo no tiene sentido la barra de tiempo */}
      <video ref={videoRef} className={styles.video} playsInline muted />
      {estado !== 'en-vivo' && placeholderSinSenal && <div className={styles.tapa}>{placeholder}</div>}
      {estado !== 'en-vivo' && !placeholderSinSenal && (
        <div className={styles.overlay}>
          {estado === 'cargando' ? 'Conectando con la cámara...' : 'Esperando la señal de la cámara...'}
        </div>
      )}
      {estado === 'en-vivo' &&
        (atrasado ? (
          <button type="button" className={`${styles.badge} ${styles.badgeAtrasado}`} onClick={irAlVivo}>
            ↻ Ir al vivo
          </button>
        ) : (
          <span className={styles.badge}>● EN VIVO</span>
        ))}
      {estado === 'en-vivo' && (
        <div className={styles.controles}>
          <button type="button" className={styles.control} onClick={alternarSonido}>
            {muteado ? '🔇 Activar sonido' : '🔊 Silenciar'}
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={pantallaCompleta}
            aria-label="Pantalla completa"
            title="Pantalla completa"
          >
            ⛶
          </button>
        </div>
      )}
    </div>
  );
}

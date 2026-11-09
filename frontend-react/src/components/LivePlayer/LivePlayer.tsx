import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
  /**
   * Qué se pone en pantalla completa (por defecto, solo el video). La sala
   * pasa el contenedor de video + barra de oferta, para poder seguir
   * ofertando en pantalla completa.
   */
  pantallaCompletaDe?: RefObject<HTMLElement | null>;
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
  pantallaCompletaDe,
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
  const [volumen, setVolumen] = useState(1);
  // Barra de controles: aparece al mover el mouse (o tocar) y se esconde sola
  const [controlesVisibles, setControlesVisibles] = useState(true);
  const ocultarRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const mostrarControles = useCallback(() => {
    setControlesVisibles(true);
    clearTimeout(ocultarRef.current);
    ocultarRef.current = setTimeout(() => setControlesVisibles(false), 2500);
  }, []);
  useEffect(() => () => clearTimeout(ocultarRef.current), []);

  const alternarSonido = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    // Si activa el sonido con el volumen en 0, lo sube a la mitad
    if (!video.muted && video.volume === 0) {
      video.volume = 0.5;
      setVolumen(0.5);
    }
    setMuteado(video.muted);
    if (!video.muted && video.paused) video.play().catch(() => undefined);
  };

  const cambiarVolumen = (valor: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = valor;
    video.muted = valor === 0;
    setVolumen(valor);
    setMuteado(video.muted);
  };

  const pantallaCompleta = () => {
    const el = pantallaCompletaDe?.current ?? contenedorRef.current;
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
    <div
      className={`${styles.playerWrapper} ${controlesVisibles ? '' : styles.sinCursor}`}
      ref={contenedorRef}
      onMouseMove={mostrarControles}
      onMouseEnter={mostrarControles}
      onMouseLeave={() => setControlesVisibles(false)}
      onTouchStart={mostrarControles}
      onFocus={mostrarControles}
    >
      {/* Sin controles nativos: en vivo no tiene sentido la barra de tiempo */}
      <video ref={videoRef} className={styles.video} playsInline muted />
      {estado !== 'en-vivo' && placeholderSinSenal && <div className={styles.tapa}>{placeholder}</div>}
      {estado !== 'en-vivo' && !placeholderSinSenal && (
        <div className={styles.overlay}>
          {estado === 'cargando' ? 'Conectando con la cámara...' : 'Esperando la señal de la cámara...'}
        </div>
      )}
      {/* "Ir al vivo" siempre a la vista cuando quedó atrás */}
      {estado === 'en-vivo' && atrasado && (
        <button type="button" className={styles.irAlVivo} onClick={irAlVivo}>
          ↻ Ir al vivo
        </button>
      )}

      {/* Barra de abajo, como un reproductor común: sonido, volumen y pantalla completa */}
      {estado === 'en-vivo' && (
        <div className={`${styles.barra} ${controlesVisibles ? styles.barraVisible : ''}`}>
          <button
            type="button"
            className={styles.icono}
            onClick={alternarSonido}
            aria-label={muteado ? 'Activar sonido' : 'Silenciar'}
            title={muteado ? 'Activar sonido' : 'Silenciar'}
          >
            {muteado ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
                <path d="m23 9-6 6M17 9l6 6" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
              </svg>
            )}
          </button>
          <input
            type="range"
            className={styles.volumen}
            min={0}
            max={1}
            step={0.05}
            value={muteado ? 0 : volumen}
            onChange={(e) => cambiarVolumen(Number(e.target.value))}
            aria-label="Volumen"
          />
          {muteado && (
            <button type="button" className={styles.textoSonido} onClick={alternarSonido}>
              Tocá para activar el sonido
            </button>
          )}
          <button
            type="button"
            className={`${styles.icono} ${styles.derecha}`}
            onClick={pantallaCompleta}
            aria-label="Pantalla completa"
            title="Pantalla completa"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

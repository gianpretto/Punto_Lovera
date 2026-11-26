import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

// Cámara del martillero en vivo por WebRTC (backend/src/sockets/camara.socket.ts).
// El video va directo del navegador del martillero a cada espectador (P2P);
// el socket solo sirve para presentarlos. Demora típica 0,2–0,4 s.

type Senal = { from: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type ConfigCamara = { auctionId: string; iceServers: RTCIceServer[] };

// Calidad pensada para un recuadro chico y ~30 espectadores en P2P: el
// martillero sube una copia por espectador (≈ 0,6 Mbps cada una)
const VIDEO: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } };
const MAX_BITRATE = 600_000;

/** Menos colchón de reproducción = menos demora (Chrome/Edge lo soportan). */
function bajaDemora(pc: RTCPeerConnection) {
  for (const r of pc.getReceivers()) {
    try {
      (r as RTCRtpReceiver & { jitterBufferTarget?: number; playoutDelayHint?: number }).jitterBufferTarget = 0;
      (r as RTCRtpReceiver & { playoutDelayHint?: number }).playoutDelayHint = 0;
    } catch {
      // navegador sin soporte: se ignora
    }
  }
}

/**
 * Espectador: con el socket de la sala, pide la cámara cuando el martillero
 * transmite y devuelve el MediaStream para un <video>.
 */
export function useCamaraEspectador(socket: Socket | null, auctionId: string | undefined) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transmitiendo, setTransmitiendo] = useState(false);

  useEffect(() => {
    if (!socket || !auctionId) return;
    let pc: RTCPeerConnection | null = null;
    let ice: RTCIceServer[] = [];
    let reintento: ReturnType<typeof setTimeout> | undefined;
    let activa = false;

    const cerrar = () => {
      clearTimeout(reintento);
      pc?.close();
      pc = null;
      setStream(null);
    };
    const pedir = () => {
      if (!activa) return;
      cerrar();
      socket.emit('cam:watch', { auctionId });
      // Si en 8 s no hubo video (se perdió la oferta, red caída), se vuelve a pedir
      reintento = setTimeout(() => {
        if (activa && pc?.connectionState !== 'connected') pedir();
      }, 8000);
    };

    const onOn = (c: ConfigCamara) => {
      if (c.auctionId !== auctionId) return;
      ice = c.iceServers;
      activa = true;
      setTransmitiendo(true);
      pedir();
    };
    const onOff = (c: { auctionId: string }) => {
      if (c.auctionId !== auctionId) return;
      activa = false;
      setTransmitiendo(false);
      cerrar();
    };
    const onSenal = async ({ from, description, candidate }: Senal) => {
      try {
        if (description?.type === 'offer') {
          pc?.close();
          const nueva = new RTCPeerConnection({ iceServers: ice });
          pc = nueva;
          nueva.ontrack = (e) => {
            bajaDemora(nueva);
            setStream(e.streams[0] ?? new MediaStream([e.track]));
          };
          nueva.onicecandidate = (e) => {
            if (e.candidate) socket.emit('cam:signal', { to: from, candidate: e.candidate.toJSON() });
          };
          nueva.onconnectionstatechange = () => {
            if (pc !== nueva) return;
            if (nueva.connectionState === 'failed' || nueva.connectionState === 'disconnected') {
              clearTimeout(reintento);
              reintento = setTimeout(pedir, 2000);
            }
          };
          await nueva.setRemoteDescription(description);
          await nueva.setLocalDescription(await nueva.createAnswer());
          socket.emit('cam:signal', { to: from, description: nueva.localDescription?.toJSON() });
        } else if (candidate && pc) {
          await pc.addIceCandidate(candidate);
        }
      } catch {
        // señal vieja o inválida: el reintento la resuelve
      }
    };

    socket.on('cam:on', onOn);
    socket.on('cam:off', onOff);
    socket.on('cam:signal', onSenal);
    // Al reconectar el socket, cam:on vuelve a llegar con auction:join
    socket.on('disconnect', cerrar);
    return () => {
      activa = false;
      socket.off('cam:on', onOn);
      socket.off('cam:off', onOff);
      socket.off('cam:signal', onSenal);
      socket.off('disconnect', cerrar);
      cerrar();
      setTransmitiendo(false);
    };
  }, [socket, auctionId]);

  return { stream, transmitiendo };
}

export type EstadoEmisor = 'apagada' | 'pidiendo' | 'conectando' | 'en-vivo' | 'error';

/**
 * Martillero: prende la cámara y el micrófono de este dispositivo y se los
 * manda a cada espectador de la sala. Usa su propio socket (el panel no
 * tiene uno). Mientras transmite, la pestaña tiene que quedar abierta.
 */
export function useCamaraEmisor(auctionId: string | undefined, token: string | null) {
  const [estado, setEstado] = useState<EstadoEmisor>('apagada');
  const [error, setError] = useState('');
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [espectadores, setEspectadores] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const conexiones = useRef(new Map<string, RTCPeerConnection>());

  const contar = () =>
    setEspectadores([...conexiones.current.values()].filter((c) => c.connectionState === 'connected').length);

  const apagar = useCallback(() => {
    const socket = socketRef.current;
    if (socket && auctionId) socket.emit('cam:stop', { auctionId });
    socket?.disconnect();
    socketRef.current = null;
    conexiones.current.forEach((c) => c.close());
    conexiones.current.clear();
    setEspectadores(0);
    setLocal((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setEstado('apagada');
  }, [auctionId]);

  const prender = useCallback(async () => {
    if (!auctionId || !token || socketRef.current) return;
    setError('');
    setEstado('pidiendo');
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: VIDEO,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setEstado('error');
      setError('No se pudo usar la cámara/micrófono. Revisá los permisos del navegador.');
      return;
    }
    setLocal(media);
    setEstado('conectando');

    const socket = io(API_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    let ice: RTCIceServer[] = [];

    socket.on('connect', () => socket.emit('auction:join', { auctionId }));
    // Ya adentro de la sala: empieza a transmitir (también al reconectar)
    socket.on('auction:state', () => socket.emit('cam:start', { auctionId }));
    socket.on('cam:started', (c: ConfigCamara) => {
      ice = c.iceServers;
      setEstado('en-vivo');
    });
    socket.on('cam:error', ({ message }: { message: string }) => {
      setError(message);
      setEstado('error');
    });
    socket.on('auction:error', ({ message }: { message: string }) => {
      setError(message);
      setEstado('error');
    });
    socket.on('cam:replaced', () => {
      apagar();
      setError('La transmisión pasó a otra pestaña o dispositivo.');
    });
    socket.on('disconnect', () => {
      conexiones.current.forEach((c) => c.close());
      conexiones.current.clear();
      contar();
      if (socketRef.current) setEstado('conectando');
    });

    // Un espectador quiere mirar: conexión nueva solo para él
    socket.on('cam:viewer', async ({ viewerId }: { viewerId: string }) => {
      conexiones.current.get(viewerId)?.close();
      const pc = new RTCPeerConnection({ iceServers: ice });
      conexiones.current.set(viewerId, pc);
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind !== 'video') continue;
        const p = sender.getParameters();
        p.encodings = p.encodings?.length ? p.encodings : [{}];
        p.encodings[0].maxBitrate = MAX_BITRATE;
        // Ante mala red: bajar resolución antes que cuadros (que no se trabe)
        p.degradationPreference = 'maintain-framerate';
        sender.setParameters(p).catch(() => undefined);
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('cam:signal', { to: viewerId, candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (conexiones.current.get(viewerId) === pc) conexiones.current.delete(viewerId);
          pc.close();
        }
        contar();
      };
      try {
        await pc.setLocalDescription(await pc.createOffer());
        socket.emit('cam:signal', { to: viewerId, description: pc.localDescription?.toJSON() });
      } catch {
        pc.close();
        conexiones.current.delete(viewerId);
      }
    });
    socket.on('cam:signal', async ({ from, description, candidate }: Senal) => {
      const pc = conexiones.current.get(from);
      if (!pc) return;
      try {
        if (description?.type === 'answer') await pc.setRemoteDescription(description);
        else if (candidate) await pc.addIceCandidate(candidate);
      } catch {
        // señal vieja: se ignora
      }
    });
    socket.on('cam:viewer-left', ({ viewerId }: { viewerId: string }) => {
      conexiones.current.get(viewerId)?.close();
      conexiones.current.delete(viewerId);
      contar();
    });
  }, [auctionId, token, apagar]);

  // Al salir del panel se corta la transmisión
  useEffect(() => apagar, [apagar]);

  return { estado, error, local, espectadores, prender, apagar };
}

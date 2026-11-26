import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { esStaff } from '../services/visibilidad';
import { autoOpenOnStream } from '../services/live.service';
import { broadcastRoomState } from '../services/realtime.service';

/**
 * Cámara del martillero en vivo por WebRTC (decisión nov 2026, VIDEO_MODE=webrtc).
 *
 * El video NO pasa por el servidor: el navegador del martillero (panel) le
 * manda la cámara directo a cada espectador (P2P, pensado para menos de ~30
 * a la vez). Acá solo se hace la "señalización": presentar a las dos partes
 * para que se conecten. Latencia típica 0,2–0,4 s (HLS/OBS: 5–15 s).
 *
 * Martillero (staff, ya entró a la sala con auction:join):
 *   → 'cam:start' { auctionId }   ← 'cam:started' { auctionId, iceServers }
 *   → 'cam:stop'  { auctionId }
 *   ← 'cam:viewer' { auctionId, viewerId }   (alguien quiere mirar: mandarle una oferta)
 *   ← 'cam:viewer-left' { auctionId, viewerId }
 * Espectador (cualquiera que haya entrado a la sala):
 *   ← 'cam:on' { auctionId, iceServers } / 'cam:off' { auctionId }
 *   → 'cam:watch' { auctionId }
 * Los dos:
 *   → 'cam:signal' { to, description? | candidate? }  ← 'cam:signal' { from, ... }
 *   'cam:signal' solo se reenvía entre el martillero que transmite y un
 *   socket que está en la sala de esa subasta.
 */

/** Socket que transmite en cada subasta (en memoria: una sola réplica) */
const emisores = new Map<string, string>();

const sala = (auctionId: string) => `auction:${auctionId}`;

type Payload = Record<string, unknown> | null | undefined;
const field = (p: Payload, key: string) => (p && typeof p === 'object' ? p[key] : undefined);
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.length <= max ? v : undefined);

/** Ventana deslizante por socket (contra scripts que inundan de señales) */
function limite(max: number, windowMs: number) {
  const hits = new WeakMap<Socket, number[]>();
  return (s: Socket) => {
    const now = Date.now();
    const recientes = (hits.get(s) ?? []).filter((t) => now - t < windowMs);
    if (recientes.length >= max) return false;
    recientes.push(now);
    hits.set(s, recientes);
    return true;
  };
}
const puedeMirar = limite(10, 10_000);
// Cada conexión son ~1 oferta/respuesta + 5-20 candidatos; el martillero
// con 30 espectadores manda bastantes
const puedeSenalizar = limite(600, 10_000);

/** ¿Hay cámara transmitiendo en esta subasta? (para el estado de la sala) */
export const camaraTransmitiendo = (auctionId: string) => emisores.has(auctionId);

/** Datos de conexión para los navegadores (STUN/TURN). */
const configCamara = (auctionId: string) => ({ auctionId, iceServers: env.video.iceServers });

export function registerCamaraHandlers(io: Server) {
  const salaDe = (socketId: string) => io.sockets.sockets.get(socketId)?.rooms;

  function cortar(auctionId: string) {
    emisores.delete(auctionId);
    io.to(sala(auctionId)).emit('cam:off', { auctionId });
  }

  io.on('connection', (socket: Socket) => {
    const staff = () => esStaff({ role: socket.data.role });

    // Al entrar a la sala con la cámara prendida: se le avisa para que mire.
    // (auction:join es asíncrono: se espera a que el socket quede en la sala)
    socket.on('auction:join', (payload: Payload) => {
      const auctionId = str(field(payload, 'auctionId'));
      if (!auctionId) return;
      let intentos = 0;
      const verificar = () => {
        if (socket.rooms.has(sala(auctionId))) {
          if (emisores.has(auctionId)) socket.emit('cam:on', configCamara(auctionId));
        } else if (++intentos < 20 && socket.connected) setTimeout(verificar, 250);
      };
      verificar();
    });

    socket.on('cam:start', async (payload: Payload) => {
      const auctionId = str(field(payload, 'auctionId'));
      if (!auctionId) return;
      if (env.video.mode !== 'webrtc') {
        return socket.emit('cam:error', { message: 'La cámara del navegador no está habilitada (VIDEO_MODE)' });
      }
      if (!staff() || !socket.rooms.has(sala(auctionId))) {
        return socket.emit('cam:error', { message: 'Solo el martillero puede transmitir, desde la sala del remate' });
      }
      const anterior = emisores.get(auctionId);
      if (anterior && anterior !== socket.id) {
        // Otra pestaña/dispositivo toma la transmisión: la anterior se corta
        io.to(anterior).emit('cam:replaced', { auctionId });
      }
      emisores.set(auctionId, socket.id);
      socket.emit('cam:started', configCamara(auctionId));
      socket.to(sala(auctionId)).emit('cam:on', configCamara(auctionId));
      // El remate empieza cuando empieza la transmisión (como con OBS)
      try {
        if (await autoOpenOnStream(auctionId)) await broadcastRoomState(auctionId);
      } catch (err) {
        console.error('[camara] no se pudo abrir la subasta:', err);
      }
    });

    socket.on('cam:stop', (payload: Payload) => {
      const auctionId = str(field(payload, 'auctionId'));
      if (auctionId && emisores.get(auctionId) === socket.id) cortar(auctionId);
    });

    socket.on('cam:watch', (payload: Payload) => {
      const auctionId = str(field(payload, 'auctionId'));
      if (!auctionId || !puedeMirar(socket)) return;
      const emisor = emisores.get(auctionId);
      if (!emisor || emisor === socket.id || !socket.rooms.has(sala(auctionId))) return;
      io.to(emisor).emit('cam:viewer', { auctionId, viewerId: socket.id });
    });

    socket.on('cam:signal', (payload: Payload) => {
      const to = str(field(payload, 'to'), 64);
      if (!to || to === socket.id || !puedeSenalizar(socket)) return;
      const description = field(payload, 'description');
      const candidate = field(payload, 'candidate');
      if (description === undefined && candidate === undefined) return;

      // Permitido solo entre el emisor de una subasta y alguien de su sala
      const destino = salaDe(to);
      if (!destino) return;
      let permitido = false;
      for (const [auctionId, emisor] of emisores) {
        const enSala = sala(auctionId);
        if (
          (emisor === socket.id && destino.has(enSala)) ||
          (emisor === to && socket.rooms.has(enSala))
        ) {
          permitido = true;
          break;
        }
      }
      if (!permitido) return;
      io.to(to).emit('cam:signal', { from: socket.id, description, candidate });
    });

    // Al irse: si transmitía, se corta; si miraba, se le avisa al emisor
    socket.on('disconnecting', () => {
      for (const [auctionId, emisor] of emisores) {
        if (emisor === socket.id) cortar(auctionId);
        else if (socket.rooms.has(sala(auctionId))) {
          io.to(emisor).emit('cam:viewer-left', { auctionId, viewerId: socket.id });
        }
      }
    });
    socket.on('auction:leave', (payload: Payload) => {
      const auctionId = str(field(payload, 'auctionId'));
      if (!auctionId) return;
      const emisor = emisores.get(auctionId);
      if (emisor === socket.id) cortar(auctionId);
      else if (emisor) io.to(emisor).emit('cam:viewer-left', { auctionId, viewerId: socket.id });
    });
  });
}

/** Expulsado del remate: el martillero corta la conexión de video con él. */
export function camaraSacarEspectador(io: Server, auctionId: string, socketId: string) {
  const emisor = emisores.get(auctionId);
  if (emisor) io.to(emisor).emit('cam:viewer-left', { auctionId, viewerId: socketId });
}

import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { validatePass } from '../services/pass.service';
import { placeBidAndBroadcast, sendChatMessage, getChatHistory, getRoomState } from '../services/realtime.service';
import { AppError } from '../utils/AppError';

/**
 * Límites por socket (anti-flood en la sala): como mucho N eventos en una
 * ventana deslizante. Generosos para una persona (en un remate se puja
 * rápido) pero cortan scripts que llenan el chat o martillan la DB.
 */
const CHAT_LIMIT = { max: 5, windowMs: 10_000 }; // 5 mensajes cada 10 s
const BID_LIMIT = { max: 10, windowMs: 10_000 }; // 10 pujas cada 10 s

/** Devuelve una función que dice si se puede hacer un evento más ahora. */
function slidingWindow({ max, windowMs }: { max: number; windowMs: number }) {
  let hits: number[] = [];
  return () => {
    const now = Date.now();
    hits = hits.filter((t) => now - t < windowMs);
    if (hits.length >= max) return false;
    hits.push(now);
    return true;
  };
}

/**
 * Mensaje para el cliente: solo los errores de negocio (AppError) se
 * muestran tal cual; cualquier otro (DB, bug) puede traer detalles internos.
 */
function clientMessage(err: unknown, fallback: string) {
  if (err instanceof AppError) return err.message;
  console.error('Error en socket:', err);
  return fallback;
}

// El payload lo manda el cliente: puede venir vacío, null o con cualquier forma
type Payload = Record<string, unknown> | null | undefined;
const field = (p: Payload, key: string) => (p && typeof p === 'object' ? p[key] : undefined);
const str = (v: unknown) => (typeof v === 'string' && v.length <= 200 ? v : undefined);

interface AuthedSocket extends Socket {
  userId?: string;
  /** Token del pase de invitado (solo mirar), si entró con uno */
  pase?: string;
}

/**
 * Sala de subasta en vivo (/subastas/:id/activa en el front).
 *
 * El cliente se conecta con el JWT en el handshake:
 *   io(URL, { auth: { token: '<jwt>' } })
 * y luego:
 *   socket.emit('auction:join', { auctionId })
 *   socket.emit('bid:place', { lotId, amount })
 *   socket.emit('chat:message', { auctionId, text })
 *
 * El servidor emite a la sala: 'auction:state' (al entrar), 'chat:history',
 * 'bid:new', 'chat:message', 'lot:change' (otro lote en remate) y
 * 'lot:sold' (lote adjudicado); y al socket que falla: 'bid:error',
 * 'chat:error', 'auction:error'.
 *
 * Se autentica en la conexión (no en cada evento) para no repetir el
 * verify del JWT en cada puja; si el token es inválido, igual dejamos
 * conectar como espectador anónimo (puede mirar pero no pujar ni chatear).
 */
export function registerBiddingHandlers(io: Server) {
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const pase = socket.handshake.auth?.pase as string | undefined;
    if (pase) socket.pase = pase;
    if (token) {
      try {
        socket.userId = verifyToken(token).userId;
      } catch {
        // token inválido: sigue como anónimo/espectador
      }
    }
    next();
  });

  io.on('connection', (socket: AuthedSocket) => {
    // Viven en el closure de esta conexión (no en un Map global), así que se
    // liberan solas al desconectar: no hay nada que limpiar a mano.
    const canChat = slidingWindow(CHAT_LIMIT);
    const canBid = slidingWindow(BID_LIMIT);

    // Ojo: los handlers nunca deben tirar con payloads raros (un throw o un
    // reject sin capturar en un listener tira abajo todo el proceso).
    socket.on('auction:join', async (payload: Payload) => {
      const auctionId = str(field(payload, 'auctionId'));
      if (!auctionId) return;
      try {
        // Para mirar hace falta sesión o un pase de invitado de esta subasta
        if (!socket.userId && !(await validatePass(socket.pase, auctionId))) {
          socket.emit('auction:error', {
            code: 'AUTH_REQUIRED',
            message: 'Registrate o iniciá sesión para ingresar al remate',
          });
          return;
        }
        // Primero el estado (valida que la subasta exista), después la sala
        const state = await getRoomState(auctionId);
        await socket.join(`auction:${auctionId}`);
        socket.emit('auction:state', state);
        socket.emit('chat:history', await getChatHistory(auctionId));
      } catch (err) {
        socket.emit('auction:error', { message: clientMessage(err, 'No se pudo entrar a la subasta') });
      }
    });

    socket.on('auction:leave', (payload: Payload) => {
      const auctionId = str(field(payload, 'auctionId'));
      if (!auctionId) return;
      socket.leave(`auction:${auctionId}`);
    });

    socket.on('bid:place', async (payload: Payload) => {
      if (!socket.userId) {
        return socket.emit('bid:error', { message: 'Tenés que iniciar sesión para pujar' });
      }
      const lotId = str(field(payload, 'lotId'));
      const amount = Number(field(payload, 'amount'));
      if (!lotId || !Number.isFinite(amount)) {
        return socket.emit('bid:error', { message: 'Puja inválida' });
      }
      if (!canBid()) {
        return socket.emit('bid:error', {
          message: 'Estás ofertando demasiado rápido. Esperá unos segundos y volvé a intentar.',
        });
      }
      try {
        await placeBidAndBroadcast(lotId, socket.userId, amount);
        // No hace falta emitir acá: placeBidAndBroadcast ya emite bid:new
        // y chat:message a toda la sala.
      } catch (err) {
        socket.emit('bid:error', { message: clientMessage(err, 'No se pudo registrar la puja') });
      }
    });

    socket.on('chat:message', async (payload: Payload) => {
      if (!socket.userId) {
        return socket.emit('chat:error', { message: 'Tenés que iniciar sesión para chatear' });
      }
      const auctionId = str(field(payload, 'auctionId'));
      const text = field(payload, 'text');
      if (!auctionId || typeof text !== 'string' || !text.trim()) return;
      if (!canChat()) {
        return socket.emit('chat:error', {
          message: 'Estás mandando mensajes muy seguido. Esperá unos segundos.',
        });
      }
      try {
        await sendChatMessage(auctionId, socket.userId, text);
      } catch (err) {
        socket.emit('chat:error', { message: clientMessage(err, 'No se pudo enviar el mensaje') });
      }
    });
  });
}

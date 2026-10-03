import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { validatePass } from '../services/pass.service';
import { placeBidAndBroadcast, sendChatMessage, getChatHistory, getRoomState } from '../services/realtime.service';

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
    socket.on('auction:join', async ({ auctionId }: { auctionId: string }) => {
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
        socket.emit('auction:error', { message: err instanceof Error ? err.message : 'No se pudo entrar a la subasta' });
      }
    });

    socket.on('auction:leave', ({ auctionId }: { auctionId: string }) => {
      if (!auctionId) return;
      socket.leave(`auction:${auctionId}`);
    });

    socket.on('bid:place', async ({ lotId, amount }: { lotId: string; amount: number }) => {
      if (!socket.userId) {
        return socket.emit('bid:error', { message: 'Tenés que iniciar sesión para pujar' });
      }
      try {
        await placeBidAndBroadcast(lotId, socket.userId, Number(amount));
        // No hace falta emitir acá: placeBidAndBroadcast ya emite bid:new
        // y chat:message a toda la sala.
      } catch (err) {
        socket.emit('bid:error', { message: err instanceof Error ? err.message : 'No se pudo registrar la puja' });
      }
    });

    socket.on('chat:message', async ({ auctionId, text }: { auctionId: string; text: string }) => {
      if (!socket.userId) {
        return socket.emit('chat:error', { message: 'Tenés que iniciar sesión para chatear' });
      }
      if (!auctionId || !text) return;
      try {
        await sendChatMessage(auctionId, socket.userId, text);
      } catch (err) {
        socket.emit('chat:error', { message: err instanceof Error ? err.message : 'No se pudo enviar el mensaje' });
      }
    });
  });
}

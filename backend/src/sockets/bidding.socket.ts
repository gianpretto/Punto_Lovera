import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { placeBidAndBroadcast, sendChatMessage, getChatHistory } from '../services/realtime.service';

interface AuthedSocket extends Socket {
  userId?: string;
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
 * Se autentica en la conexión (no en cada evento) para no repetir el
 * verify del JWT en cada puja; si el token es inválido, igual dejamos
 * conectar como espectador anónimo (puede mirar pero no pujar ni chatear).
 */
export function registerBiddingHandlers(io: Server) {
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
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
      await socket.join(`auction:${auctionId}`);
      const history = await getChatHistory(auctionId);
      socket.emit('chat:history', history);
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

import http from 'http';
import { Server } from 'socket.io';
import { app } from './app';
import { env } from './config/env';
import { setIo } from './sockets/io';
import { registerBiddingHandlers } from './sockets/bidding.socket';

/**
 * Arma el http server (Express) + Socket.io sin ponerlo a escuchar.
 * server.ts lo usa para arrancar la API; los tests de integración lo
 * levantan en un puerto efímero (listen(0)) sin efectos colaterales.
 */
export function createServer() {
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.frontendOrigins, credentials: true },
    maxHttpBufferSize: 16 * 1024, // 16 KB: los eventos de la sala son chicos (default 1 MB)
  });
  setIo(io);
  registerBiddingHandlers(io);

  return { server, io };
}

import http from 'http';
import { Server } from 'socket.io';
import { app } from './app';
import { env } from './config/env';
import { setIo } from './sockets/io';
import { registerBiddingHandlers } from './sockets/bidding.socket';

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: env.frontendOrigins, credentials: true },
  maxHttpBufferSize: 16 * 1024, // 16 KB: los eventos de la sala son chicos (default 1 MB)
});
setIo(io);
registerBiddingHandlers(io);

server.listen(env.port, () => {
  console.log(`🚀 Punto Lovera API escuchando en http://localhost:${env.port}`);
  console.log(`   WebSocket listo en el mismo puerto (Socket.io)`);
});

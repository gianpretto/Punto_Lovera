import { env } from './config/env';
import { createServer } from './createServer';

const { server } = createServer();

server.listen(env.port, () => {
  console.log(`🚀 Punto Lovera API escuchando en http://localhost:${env.port}`);
  console.log(`   WebSocket listo en el mismo puerto (Socket.io)`);
});

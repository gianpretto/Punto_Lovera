import { env } from './config/env';
import { createServer } from './createServer';
import { iniciarAperturaAutomatica } from './services/apertura.service';

const { server } = createServer();
// Subastas cuya cuenta regresiva llegó a cero → ACTIVA
iniciarAperturaAutomatica();

server.listen(env.port, () => {
  console.log(`🚀 Punto Lovera API escuchando en http://localhost:${env.port}`);
  console.log(`   WebSocket listo en el mismo puerto (Socket.io)`);
  if (env.skipEmailVerification) {
    console.warn('⚠️  SKIP_EMAIL_VERIFICATION=true: no se pide validar el mail (solo para pruebas, nunca en producción)');
  }
});

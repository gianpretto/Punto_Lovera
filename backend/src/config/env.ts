import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name} (revisá tu .env, copiá .env.example)`);
  }
  return value;
}

// OBS necesita "rtmp://" adelante; se agrega si se cargó solo host:puerto/live
function withRtmpScheme(url: string) {
  const u = url.trim();
  return /^rtmps?:\/\//i.test(u) ? u : `rtmp://${u}`;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  // FRONTEND_URL puede ser una lista separada por comas (ej: el dominio de
  // Vercel + http://localhost:5173). La primera se usa para los links de
  // los mails; todas quedan permitidas por CORS (HTTP y Socket.io).
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',')[0].trim(),
  frontendOrigins: (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // Dónde se guardan los archivos subidos. En Railway apuntarlo a un Volume
  // (ej: /data/uploads), si no se pierden en cada deploy.
  uploadDir: process.env.UPLOAD_DIR || '',

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Punto Lovera <no-responder@puntolovera.com>',
  },

  transfer: {
    alias: process.env.TRANSFER_ALIAS ?? '',
    cbu: process.env.TRANSFER_CBU ?? '',
    holder: process.env.TRANSFER_HOLDER ?? '',
    // Texto libre, ej: "Cuenta corriente en pesos 123-456/7 — Banco X"
    account: process.env.TRANSFER_ACCOUNT ?? '',
  },

  // rtsp-manager (repo de Francis): control-plane (API que prende/apaga
  // cámaras, server-to-server, NUNCA expuesto al público) y media server
  // (nginx-rtmp, sirve los .m3u8/.mpd — lo exponemos nosotros a través de
  // un proxy propio que exige el mismo JWT que el resto de la API).
  rtsp: {
    controlUrl: process.env.RTSP_CONTROL_URL ?? 'http://localhost:5000',
    // Servidor de video (media-server/ o el nginx de rtsp-manager): de acá
    // salen los HLS que el backend proxea con auth
    mediaUrl: process.env.MEDIA_SERVER_URL ?? process.env.RTSP_MEDIA_URL ?? 'http://localhost:8080',
  },

  // Video en vivo (decisión oct 2026): "obs" = el martillero transmite desde
  // OBS al media-server con una clave por subasta. "rtsp" = modo anterior
  // con rtsp-manager tomando una cámara IP.
  video: {
    mode: (process.env.VIDEO_MODE === 'rtsp' ? 'rtsp' : 'obs') as 'obs' | 'rtsp',
    // Lo que el martillero pega en OBS como "Servidor", ej:
    // rtmp://xxxx.proxy.rlwy.net:12345/live (TCP Proxy de Railway al 1935)
    rtmpPublicUrl: withRtmpScheme(process.env.RTMP_PUBLIC_URL ?? 'rtmp://localhost:1935/live'),
    // Compartido con media-server: nginx lo manda al validar una clave
    // trim: en el panel de Railway es fácil pegarlo con un salto de línea al final
    rtmpAuthSecret: (process.env.RTMP_AUTH_SECRET ?? '').trim(),
  },

  isProd: process.env.NODE_ENV === 'production',
};

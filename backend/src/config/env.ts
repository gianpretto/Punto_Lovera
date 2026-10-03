import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name} (revisá tu .env, copiá .env.example)`);
  }
  return value;
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
    mediaUrl: process.env.RTSP_MEDIA_URL ?? 'http://localhost:8080',
  },

  isProd: process.env.NODE_ENV === 'production',
};

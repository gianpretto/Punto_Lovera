import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, inject } from 'vitest';

// Corre antes de cada archivo de test, ANTES de que se importe
// src/config/env.ts (la app se importa recién en startTestApp).
//
// dotenv no pisa variables ya definidas, pero además apuntamos
// DOTENV_CONFIG_PATH a un archivo que no existe: los tests nunca deben leer
// backend/.env (la base de desarrollo es compartida, y con SMTP real se
// mandarían mails de verdad).
process.env.DOTENV_CONFIG_PATH = path.join(os.tmpdir(), 'punto-lovera-tests-sin-dotenv');

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'punto-lovera-uploads-'));

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: inject('databaseUrl'),
  MIGRATIONS_DATABASE_URL: '',
  JWT_SECRET: 'secreto-de-tests',
  JWT_EXPIRES_IN: '1h',
  // Lista de orígenes permitidos por CORS (como en producción)
  FRONTEND_URL: 'https://punto-lovera.vercel.app,http://localhost:5173',
  UPLOAD_DIR: uploadDir,
  // Sin SMTP: los mails se "simulan" por consola
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASS: '',
  TRANSFER_ALIAS: 'puntolovera.test',
  TRANSFER_CBU: '0000000000000000000000',
  TRANSFER_HOLDER: 'Punto Lovera SRL',
  TRANSFER_ACCOUNT: 'Cuenta corriente en pesos - Banco Test',
  VIDEO_MODE: 'obs',
  RTMP_PUBLIC_URL: 'rtmp://localhost:1935/live',
  RTMP_AUTH_SECRET: 'secreto-rtmp-de-tests',
  // Puerto cerrado: sin media-server responde "connection refused" enseguida.
  // El test de video levanta uno falso y pisa esta variable.
  MEDIA_SERVER_URL: 'http://127.0.0.1:9',
  RTSP_MEDIA_URL: 'http://127.0.0.1:9',
  RTSP_CONTROL_URL: 'http://127.0.0.1:9',
});

afterAll(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

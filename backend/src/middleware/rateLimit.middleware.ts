import { Request } from 'express';
import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';

/**
 * Límites de intentos por IP (en memoria: alcanza mientras haya una sola
 * instancia del backend; si se escala a varias réplicas habría que pasar a
 * un store compartido, ej. Redis).
 *
 * La IP sale de req.ip, que depende de `trust proxy` (ver app.ts).
 */

const MIN = 60 * 1000;

// Mismo formato que error.middleware.ts: { error: '...' }
function limiter(windowMs: number, limit: number, message: string, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // RateLimit / RateLimit-Policy (el front puede leer cuándo reintentar)
    legacyHeaders: false,
    message: { error: message },
    ...extra,
  });
}

// IP normalizada (IPv6 agrupado por /56, para que no se pueda esquivar el
// límite rotando direcciones dentro del mismo bloque)
const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '');

// Email del body normalizado, si vino (para combinar con la IP)
const emailOf = (req: Request) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

/**
 * Login: 10 intentos fallidos cada 15 min por IP + email. La clave incluye
 * el email para que en una red compartida (oficina, NAT del celular) un
 * usuario que se equivoca no bloquee a los demás; y solo cuentan los
 * fallidos, así el que entra bien no gasta intentos.
 */
export const loginLimiter = limiter(15 * MIN, 10, 'Demasiados intentos de inicio de sesión. Esperá 15 minutos y probá de nuevo.', {
  keyGenerator: (req) => `${ipKey(req)}|${emailOf(req)}`,
  skipSuccessfulRequests: true,
});

/**
 * Tope extra de login por IP sola (50 / 15 min), para que no se puedan
 * probar contraseñas contra muchos emails distintos desde la misma IP.
 */
export const loginIpLimiter = limiter(15 * MIN, 50, 'Demasiados intentos de inicio de sesión desde tu conexión. Esperá 15 minutos y probá de nuevo.', {
  keyGenerator: ipKey,
  skipSuccessfulRequests: true,
});

// Registro: 5 cuentas por hora por IP (cada una dispara un mail)
export const registerLimiter = limiter(60 * MIN, 5, 'Demasiados registros desde tu conexión. Probá de nuevo en una hora.', {
  keyGenerator: ipKey,
});

/**
 * Endpoints que mandan mails (recuperar contraseña, reenviar verificación):
 * 5 por hora por IP. Evita usar el sitio para spamear casillas ajenas y
 * gastar la cuota de SMTP. Cada endpoint lleva su propio contador.
 */
const mailLimiter = () =>
  limiter(60 * MIN, 5, 'Hiciste demasiados pedidos de mail. Revisá tu casilla (y spam) o probá de nuevo en una hora.', {
    keyGenerator: ipKey,
  });
export const forgotPasswordLimiter = mailLimiter();
export const resendVerificationLimiter = mailLimiter();

/**
 * Validación de tokens (verificar mail, reset de contraseña): 20 cada
 * 15 min por IP. Los tokens son de 256 bits, así que no se pueden adivinar;
 * esto es más que nada para cortar scripts que martillan el endpoint.
 */
const tokenLimiter = () =>
  limiter(15 * MIN, 20, 'Demasiados intentos. Esperá unos minutos y probá de nuevo.', {
    keyGenerator: ipKey,
  });
export const verifyEmailLimiter = tokenLimiter();
export const resetPasswordLimiter = tokenLimiter();

/**
 * General para toda la API: 600 requests por minuto por IP (10/s
 * sostenidos). Una persona navegando hace muchas menos; el margen es por
 * IPs compartidas (NAT de celulares, oficinas). Se excluyen:
 *  - el proxy de video (GET /subastas/:id/vivo/...): el reproductor HLS pide
 *    playlist + un segmento cada pocos segundos durante todo el remate;
 *  - el callback interno de nginx-rtmp (POST /live/rtmp/publish), que viene
 *    siempre de la IP del media-server y ya está protegido con secreto.
 */
export const apiLimiter = limiter(1 * MIN, 600, 'Demasiadas solicitudes. Esperá un momento y probá de nuevo.', {
  keyGenerator: ipKey,
  // req.path es relativo a donde se monta (/api)
  skip: (req) =>
    (req.method === 'GET' && /^\/subastas\/[^/]+\/vivo\//.test(req.path)) ||
    (req.method === 'POST' && req.path === '/live/rtmp/publish'),
});

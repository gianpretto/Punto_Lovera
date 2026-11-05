import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';

// "Continuar con Google": el front usa el botón de Google Identity Services,
// que le devuelve un ID token (JWT firmado por Google). Acá se verifica la
// firma, que sea para nuestro Client ID y que el mail esté verificado por
// Google; recién ahí se confía en el mail.

export interface GoogleProfile {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
}

const client = new OAuth2Client();

export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!env.googleClientId) throw Errors.badRequest('El ingreso con Google no está habilitado');

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw Errors.unauthorized('No se pudo validar la cuenta de Google');
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw Errors.unauthorized('La cuenta de Google no tiene un mail verificado');
  }

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    firstName: payload.given_name?.trim() || payload.name?.trim() || '',
    lastName: payload.family_name?.trim() || '',
  };
}

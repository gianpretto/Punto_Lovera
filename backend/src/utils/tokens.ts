import crypto from 'crypto';

// Tokens random para verificación de mail / reset de contraseña
// (no son JWT: son opacos y se guardan en la DB para poder invalidarlos).
export function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

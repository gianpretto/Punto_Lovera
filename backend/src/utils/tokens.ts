import crypto from 'crypto';

// Tokens random para verificación de mail / reset de contraseña
// (no son JWT: son opacos y se guardan en la DB para poder invalidarlos).
export function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Lo que se guarda en la DB es el SHA-256 del token, no el token: el crudo
 * solo viaja en el mail. Así, si se filtra la base (backup, dump, acceso de
 * lectura) no se pueden usar los links pendientes para verificar cuentas ni
 * cambiar contraseñas. Alcanza con SHA-256 sin sal porque el token ya tiene
 * 256 bits aleatorios (no es una contraseña elegida por una persona).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

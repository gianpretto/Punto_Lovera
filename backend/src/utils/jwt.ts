import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  role: 'USER' | 'MARTILLERO' | 'ADMIN';
  /** users.session_version al emitir el token (los viejos sin sv cuentan como 0) */
  sv?: number;
}

/** `recordar`: sesión larga ("Recordarme" en el login, o ingreso con Google) */
export function signToken(payload: JwtPayload, recordar = false): string {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: (recordar ? env.jwtRememberExpiresIn : env.jwtExpiresIn) as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  // Algoritmo fijo: no aceptar tokens firmados con otro (ej: "none")
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
}

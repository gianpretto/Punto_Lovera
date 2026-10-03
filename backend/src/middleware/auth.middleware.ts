import { NextFunction, Request, Response } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { Errors } from '../utils/AppError';
import { validatePass } from '../services/pass.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Exige un JWT válido en el header Authorization: Bearer <token> */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(Errors.unauthorized());

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(Errors.unauthorized('Sesión inválida o expirada'));
  }
}

/** Igual que requireAuth pero no falla si no hay token: solo lo adjunta si es válido. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // token inválido: seguimos como anónimo
    }
  }
  next();
}

/** Exige que el usuario autenticado tenga uno de los roles indicados. */
export function requireRole(...roles: JwtPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Errors.unauthorized());
    if (!roles.includes(req.user.role)) return next(Errors.forbidden());
    next();
  };
}

/**
 * Para ver el video en vivo: alcanza con un JWT válido o con un pase de
 * invitado vigente para ESA subasta (header X-Pase; hls.js lo manda en cada
 * request del playlist y los segmentos).
 */
export function requireAuthOrPass(param = 'id') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token) {
      try {
        req.user = verifyToken(token);
        return next();
      } catch {
        // sigue: puede venir también con pase
      }
    }
    const pase = req.headers['x-pase'];
    try {
      const pass = await validatePass(typeof pase === 'string' ? pase : undefined, req.params[param]);
      if (pass) return next();
    } catch (err) {
      return next(err);
    }
    next(Errors.unauthorized('Necesitás iniciar sesión o un pase válido para ver esta subasta'));
  };
}

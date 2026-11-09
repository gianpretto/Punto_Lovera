import { eq, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { signToken, verifyToken, type JwtPayload } from '../utils/jwt';

/**
 * Sesiones revocables. El JWT lleva `sv` (users.session_version); al
 * cambiar o recuperar la contraseña, o al dar de baja la cuenta, se sube
 * la versión y todos los tokens anteriores dejan de valer.
 *
 * Además el rol se toma de la base y no del token: si a alguien le sacan el
 * rol de admin, lo pierde enseguida (no cuando vence su token).
 *
 * Para no consultar la base en cada pedido (el video pide un segmento cada
 * pocos segundos) se guarda en memoria unos segundos. Con una sola
 * instancia del backend alcanza; con varias réplicas, el cambio tarda como
 * mucho CACHE_MS en verse en las otras.
 */

const CACHE_MS = 30_000;

type Estado = { role: JwtPayload['role']; sv: number; baja: boolean; hasta: number };
const cache = new Map<string, Estado>();

// Limpieza de lo vencido para que el mapa no crezca. unref: no frena el apagado.
setInterval(() => {
  const ahora = Date.now();
  for (const [id, e] of cache) if (e.hasta < ahora) cache.delete(id);
}, 5 * 60_000).unref();

async function estadoDe(userId: string): Promise<Estado | null> {
  const enCache = cache.get(userId);
  if (enCache && enCache.hasta > Date.now()) return enCache;

  const [u] = await db
    .select({ role: users.role, sv: users.sessionVersion, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!u) return null;
  const estado = { role: u.role, sv: u.sv, baja: Boolean(u.deletedAt), hasta: Date.now() + CACHE_MS };
  cache.set(userId, estado);
  return estado;
}

/**
 * Valida un token: firma, vencimiento, que la cuenta exista y no esté dada
 * de baja, y que la sesión no haya sido cerrada. Devuelve el payload con el
 * rol actual. Tira 401 si no sirve.
 */
export async function authenticate(token: string): Promise<JwtPayload> {
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw Errors.unauthorized('Sesión inválida o expirada');
  }
  const estado = await estadoDe(payload.userId);
  if (!estado || estado.baja || (payload.sv ?? 0) !== estado.sv) {
    throw Errors.unauthorized('Tu sesión se cerró. Volvé a iniciar sesión.');
  }
  return { userId: payload.userId, role: estado.role, sv: estado.sv };
}

/** Token nuevo para un usuario (con su versión de sesión actual). */
export function tokenFor(user: { id: string; role: JwtPayload['role']; sessionVersion: number }, recordar = false) {
  return signToken({ userId: user.id, role: user.role, sv: user.sessionVersion }, recordar);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Cierra todas las sesiones del usuario. Devuelve la versión nueva. */
export async function revokeSessions(userId: string, exec: typeof db | Tx = db) {
  const [row] = await exec
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sv: users.sessionVersion });
  cache.delete(userId);
  return row?.sv;
}

/** Olvidar lo guardado de un usuario (ej: le cambiaron el rol). */
export function forgetSession(userId: string) {
  cache.delete(userId);
}

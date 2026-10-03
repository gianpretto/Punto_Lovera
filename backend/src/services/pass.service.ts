import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../config/db';
import { auctionPasses, auctions } from '../db/schema';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';
import { randomToken } from '../utils/tokens';

/**
 * Pases de invitado ("pasaporte"): link temporal para MIRAR una subasta en
 * vivo (video + chat en lectura) sin crearse una cuenta. Pedido del cliente
 * para clientes de única vez (ej: el dueño del local que se remata). No
 * crean usuarios; vencen solos y se pueden revocar. Con un pase no se puede
 * pujar ni escribir en el chat.
 */

const MAX_HOURS = 24 * 14;

export function passLink(auctionId: string, token: string) {
  return `${env.frontendUrl}/subastas/${auctionId}/activa?pase=${token}`;
}

export async function createPass(auctionId: string, createdById: string, label: string, hours: number) {
  const [auction] = await db.select({ id: auctions.id }).from(auctions).where(eq(auctions.id, auctionId));
  if (!auction) throw Errors.notFound('Subasta');
  const h = Math.min(Math.max(hours, 1), MAX_HOURS);

  const [pass] = await db
    .insert(auctionPasses)
    .values({
      auctionId,
      token: randomToken(),
      label,
      expiresAt: new Date(Date.now() + h * 60 * 60 * 1000),
      createdById,
    })
    .returning();
  return { ...pass, link: passLink(auctionId, pass.token) };
}

/** Pases vigentes (no vencidos ni revocados) de una subasta, más nuevos primero. */
export async function listPasses(auctionId: string) {
  const passes = await db
    .select()
    .from(auctionPasses)
    .where(
      and(eq(auctionPasses.auctionId, auctionId), isNull(auctionPasses.revokedAt), gt(auctionPasses.expiresAt, new Date()))
    )
    .orderBy(desc(auctionPasses.createdAt));
  return passes.map((p) => ({ ...p, link: passLink(auctionId, p.token) }));
}

export async function revokePass(auctionId: string, passId: string) {
  const [pass] = await db
    .update(auctionPasses)
    .set({ revokedAt: new Date() })
    .where(and(eq(auctionPasses.id, passId), eq(auctionPasses.auctionId, auctionId)))
    .returning();
  if (!pass) throw Errors.notFound('Pase');
}

/**
 * Devuelve el pase si es válido (existe, no venció, no fue revocado) y, si
 * se indica auctionId, corresponde a esa subasta. Si no, null.
 */
export async function validatePass(token: string | undefined | null, auctionId?: string) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const [pass] = await db
    .select()
    .from(auctionPasses)
    .where(
      and(eq(auctionPasses.token, token), isNull(auctionPasses.revokedAt), gt(auctionPasses.expiresAt, new Date()))
    );
  if (!pass) return null;
  if (auctionId && pass.auctionId !== auctionId) return null;

  // Uso informativo para el martillero; no hace falta esperarlo
  db.update(auctionPasses)
    .set({ lastUsedAt: new Date() })
    .where(eq(auctionPasses.id, pass.id))
    .catch(() => undefined);
  return pass;
}

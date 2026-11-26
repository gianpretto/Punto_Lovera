import { and, desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, lotFavorites, lots } from '../db/schema';
import { Errors } from '../utils/AppError';
import { lotePublico } from './visibilidad';

/** Lotes favoritos de cada usuario (pedido del cliente, nov 2026). */

export async function addFavorite(userId: string, lotId: string) {
  const [lot] = await db
    .select({ id: lots.id, published: auctions.published })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(eq(lots.id, lotId));
  if (!lot || !lot.published) throw Errors.notFound('Lote');
  await db.insert(lotFavorites).values({ userId, lotId }).onConflictDoNothing();
}

export async function removeFavorite(userId: string, lotId: string) {
  await db.delete(lotFavorites).where(and(eq(lotFavorites.userId, userId), eq(lotFavorites.lotId, lotId)));
}

/** Solo los ids (para marcar el corazón en el catálogo) */
export async function favoriteIds(userId: string) {
  const rows = await db.select({ lotId: lotFavorites.lotId }).from(lotFavorites).where(eq(lotFavorites.userId, userId));
  return rows.map((r) => r.lotId);
}

/** La página de favoritos: los lotes con su subasta y fotos (los de subastas publicadas) */
export async function listFavorites(userId: string) {
  const rows = await db.query.lotFavorites.findMany({
    where: eq(lotFavorites.userId, userId),
    orderBy: desc(lotFavorites.createdAt),
    with: {
      lot: {
        with: {
          images: { orderBy: (i, { asc }) => asc(i.position) },
          auction: { columns: { id: true, title: true, startsAt: true, status: true, location: true, published: true } },
        },
      },
    },
  });
  return rows
    .filter((r) => r.lot.auction.published)
    .map((r) => ({ ...lotePublico(r.lot, false), favoritedAt: r.createdAt }));
}

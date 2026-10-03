import { and, asc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, lots } from '../db/schema';
import { Errors } from '../utils/AppError';

type AuctionStatus = (typeof auctions.$inferSelect)['status'];

export async function listAuctions(status?: AuctionStatus) {
  return db.query.auctions.findMany({
    where: status ? eq(auctions.status, status) : undefined,
    orderBy: (a, { asc }) => asc(a.startsAt),
    with: { lots: { columns: { id: true } } },
  });
}

export async function getAuctionById(id: string) {
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, id),
    with: {
      lots: {
        with: { images: true },
        orderBy: (l, { asc }) => asc(l.number),
      },
    },
  });
  if (!auction) throw Errors.notFound('Subasta');
  return auction;
}

/**
 * Lote en remate ahora: el que eligió el martillero (si sigue sin vender)
 * o, si no eligió ninguno, el primer lote sin vender por número.
 */
export async function getCurrentLot(auctionId: string) {
  const [auction] = await db
    .select({ currentLotId: auctions.currentLotId })
    .from(auctions)
    .where(eq(auctions.id, auctionId));
  if (!auction) throw Errors.notFound('Subasta');

  if (auction.currentLotId) {
    const chosen = await db.query.lots.findFirst({
      where: and(eq(lots.id, auction.currentLotId), eq(lots.auctionId, auctionId)),
      with: { images: { orderBy: (i, { asc }) => asc(i.position) } },
    });
    if (chosen && !chosen.sold) return chosen;
  }

  const next = await db.query.lots.findFirst({
    where: and(eq(lots.auctionId, auctionId), eq(lots.sold, false)),
    orderBy: asc(lots.number),
    with: { images: { orderBy: (i, { asc }) => asc(i.position) } },
  });
  return next ?? null;
}

export async function setCurrentLot(auctionId: string, lotId: string | null) {
  if (lotId) {
    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, lotId), eq(lots.auctionId, auctionId)));
    if (!lot) throw Errors.notFound('Lote');
    if (lot.sold) throw Errors.badRequest('Ese lote ya fue adjudicado');
  }
  const [updated] = await db
    .update(auctions)
    .set({ currentLotId: lotId, updatedAt: new Date() })
    .where(eq(auctions.id, auctionId))
    .returning();
  if (!updated) throw Errors.notFound('Subasta');
}

export async function createAuction(
  createdById: string,
  data: { title: string; description: string; location: string; startsAt: Date; coverImageUrl?: string }
) {
  const [auction] = await db.insert(auctions).values({ ...data, createdById }).returning();
  return auction;
}

export async function updateAuction(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    coverImageUrl: string;
    status: AuctionStatus;
  }>
) {
  await getAuctionById(id);
  const [auction] = await db
    .update(auctions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(auctions.id, id))
    .returning();
  return auction;
}

export async function deleteAuction(id: string) {
  await getAuctionById(id);
  await db.delete(auctions).where(eq(auctions.id, id));
}

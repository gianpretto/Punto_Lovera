import { and, desc, eq, inArray, max, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, bids, lots, purchases, users } from '../db/schema';
import { Errors } from '../utils/AppError';

function generateReference() {
  const date = new Date();
  const y = date.getFullYear();
  const rand = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return `PL-${y}-${rand}`;
}

/** Cierra un lote: lo marca vendido y genera el registro de compra para el mejor postor. */
export async function closeLotAndCreatePurchase(lotId: string) {
  const [lot] = await db.select().from(lots).where(eq(lots.id, lotId));
  if (!lot) throw Errors.notFound('Lote');
  if (lot.sold) throw Errors.badRequest('Este lote ya fue cerrado');

  const [winningBid] = await db
    .select()
    .from(bids)
    .where(eq(bids.lotId, lotId))
    .orderBy(desc(bids.amount))
    .limit(1);
  if (!winningBid) throw Errors.badRequest('Este lote no tiene pujas, no se puede cerrar con comprador');

  return db.transaction(async (tx) => {
    // El monto ya estaba reservado mientras iba ganando; ahora se descuenta
    // del saldo de verdad (y al quedar sold=true la reserva desaparece).
    const [winner] = await tx.select().from(users).where(eq(users.id, winningBid.userId)).for('update');
    if (!winner || Number(winner.creditBalance) < Number(winningBid.amount)) {
      throw Errors.badRequest('El ganador no tiene saldo suficiente para cubrir la compra');
    }
    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} - ${winningBid.amount}`, updatedAt: new Date() })
      .where(eq(users.id, winner.id));

    await tx.update(lots).set({ sold: true, updatedAt: new Date() }).where(eq(lots.id, lotId));
    const [purchase] = await tx
      .insert(purchases)
      .values({
        userId: winningBid.userId,
        lotId,
        reference: generateReference(),
        totalAmount: winningBid.amount,
      })
      .returning();
    return purchase;
  });
}

export async function listMyPurchases(userId: string) {
  return db.query.purchases.findMany({
    where: eq(purchases.userId, userId),
    orderBy: (p, { desc }) => desc(p.createdAt),
    with: { lot: { with: { auction: true } } },
  });
}

/**
 * Ofertas en curso: lotes todavía sin adjudicar (en subastas abiertas) en
 * los que el usuario pujó, con su mejor oferta y si va ganando.
 */
export async function listMyActiveOffers(userId: string) {
  const rows = await db
    .select({
      lotId: lots.id,
      lotNumber: lots.number,
      lotTitle: lots.title,
      auctionId: auctions.id,
      auctionTitle: auctions.title,
      auctionStatus: auctions.status,
      currentPrice: lots.currentPrice,
      leaderId: lots.leaderId,
      myBestBid: max(bids.amount),
    })
    .from(bids)
    .innerJoin(lots, eq(bids.lotId, lots.id))
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(eq(bids.userId, userId), eq(lots.sold, false), inArray(auctions.status, ['PROXIMA', 'ACTIVA'])))
    .groupBy(lots.id, auctions.id)
    .orderBy(auctions.title, lots.number);

  return rows.map((r) => ({
    lotId: r.lotId,
    lotNumber: r.lotNumber,
    lotTitle: r.lotTitle,
    auctionId: r.auctionId,
    auctionTitle: r.auctionTitle,
    auctionStatus: r.auctionStatus,
    currentPrice: Number(r.currentPrice),
    myBestBid: Number(r.myBestBid),
    winning: r.leaderId === userId,
  }));
}

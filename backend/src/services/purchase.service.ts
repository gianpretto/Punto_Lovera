import { and, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, bids, lots, purchases, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { factorDeCredito, getCreditConfig } from './settings.service';

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

  // Gana quien va ganando el lote al precio actual (leader_id/current_price):
  // ya contemplan las ofertas que el martillero anuló o corrigió en vivo.
  const winningBid = lot.leaderId ? { userId: lot.leaderId, amount: lot.currentPrice } : null;
  if (!winningBid) throw Errors.badRequest('Este lote no tiene pujas, no se puede cerrar con comprador');

  return db.transaction(async (tx) => {
    // El monto ya estaba reservado mientras iba ganando; ahora se descuenta
    // del saldo de verdad (y al quedar sold=true la reserva desaparece).
    // Cuánto se descuenta depende del modo de créditos: el monto entero
    // (CREDITO), el % de garantía como seña (GARANTIA) o nada (SIN_CREDITO:
    // el pago se arregla fuera de la plataforma).
    const descuento = Math.ceil(Number(winningBid.amount) * factorDeCredito(await getCreditConfig(tx)));
    const [winner] = await tx.select().from(users).where(eq(users.id, winningBid.userId)).for('update');
    if (!winner) throw Errors.badRequest('No se encontró al ganador');
    if (descuento > 0) {
      if (Number(winner.creditBalance) < descuento) {
        throw Errors.badRequest('El ganador no tiene saldo suficiente para cubrir la compra');
      }
      await tx
        .update(users)
        .set({ creditBalance: sql`${users.creditBalance} - ${descuento}`, updatedAt: new Date() })
        .where(eq(users.id, winner.id));
    }

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
    .where(
      and(
        eq(bids.userId, userId),
        isNull(bids.voidedAt),
        eq(lots.sold, false),
        inArray(auctions.status, ['PROXIMA', 'ACTIVA'])
      )
    )
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

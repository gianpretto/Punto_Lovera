import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../config/db';
import { auctionSanctions, bids, lots, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { getCurrentLot } from './auction.service';

/**
 * Controles del martillero en vivo (pedido del cliente, nov 2026): corregir
 * el precio y quién va ganando, cambiar el incremento o fijar la próxima
 * oferta mínima, anular ofertas (ej. alguien que oferta en joda) y pasar al
 * siguiente lote. Las reservas de crédito se recalculan solas porque salen
 * de lots.leader_id / current_price (credit.service.ts).
 */

async function lotOfAuction(auctionId: string, lotId: string) {
  const [lot] = await db
    .select()
    .from(lots)
    .where(and(eq(lots.id, lotId), eq(lots.auctionId, auctionId)));
  if (!lot) throw Errors.notFound('Lote');
  if (lot.sold) throw Errors.badRequest('Este lote ya fue adjudicado');
  return lot;
}

export interface LiveLotChanges {
  currentPrice?: number;
  leaderId?: string | null;
  bidIncrement?: number;
  nextMinBid?: number | null;
}

export async function updateLiveLot(auctionId: string, lotId: string, changes: LiveLotChanges) {
  await lotOfAuction(auctionId, lotId);

  if (changes.leaderId) {
    // Solo alguien que ofertó (sin anular) en este lote puede quedar ganando
    const [bid] = await db
      .select({ id: bids.id })
      .from(bids)
      .where(and(eq(bids.lotId, lotId), eq(bids.userId, changes.leaderId), isNull(bids.voidedAt)))
      .limit(1);
    if (!bid) throw Errors.badRequest('Ese usuario no tiene ofertas válidas en este lote');
  }

  const set: Partial<typeof lots.$inferInsert> = { updatedAt: new Date() };
  if (changes.currentPrice !== undefined) set.currentPrice = String(changes.currentPrice);
  if (changes.leaderId !== undefined) set.leaderId = changes.leaderId;
  if (changes.bidIncrement !== undefined) set.bidIncrement = String(changes.bidIncrement);
  if (changes.nextMinBid !== undefined) set.nextMinBid = changes.nextMinBid === null ? null : String(changes.nextMinBid);

  const [updated] = await db.update(lots).set(set).where(eq(lots.id, lotId)).returning();
  return updated;
}

/**
 * Anula una oferta. Si era la que iba ganando, el lote vuelve a la mejor
 * oferta que queda sin anular (o al precio base, sin ganador).
 */
export async function voidBid(auctionId: string, bidId: string, reviewerId: string) {
  const [bid] = await db.select().from(bids).where(eq(bids.id, bidId));
  if (!bid) throw Errors.notFound('Oferta');
  const lot = await lotOfAuction(auctionId, bid.lotId);
  if (bid.voidedAt) throw Errors.badRequest('Esta oferta ya estaba anulada');

  return db.transaction(async (tx) => {
    await tx.update(bids).set({ voidedAt: new Date(), voidedById: reviewerId }).where(eq(bids.id, bidId));

    const [best] = await tx
      .select()
      .from(bids)
      .where(and(eq(bids.lotId, lot.id), isNull(bids.voidedAt)))
      .orderBy(desc(bids.amount), asc(bids.createdAt))
      .limit(1);

    // Se recalcula si la anulada era de quien va ganando (o no queda
    // ninguna). Si era de otro, el precio y el ganador no cambian.
    if (lot.leaderId === bid.userId || !best) {
      await tx
        .update(lots)
        .set({
          currentPrice: best ? best.amount : lot.startingPrice,
          leaderId: best ? best.userId : null,
          nextMinBid: null,
          updatedAt: new Date(),
        })
        .where(eq(lots.id, lot.id));
    }
    return { bidId, lotId: lot.id };
  });
}

/** Siguiente lote sin vender (por número) después del que está en remate. */
export async function nextLotId(auctionId: string) {
  const current = await getCurrentLot(auctionId);
  if (!current) throw Errors.badRequest('No quedan lotes sin adjudicar');
  const [next] = await db
    .select({ id: lots.id })
    .from(lots)
    .where(and(eq(lots.auctionId, auctionId), eq(lots.sold, false), gt(lots.number, current.number)))
    .orderBy(asc(lots.number))
    .limit(1);
  if (!next) throw Errors.badRequest('Este es el último lote sin adjudicar');
  return next.id;
}

// ---------- Moderación (silenciar / expulsar, solo en ese remate) ----------

export type SanctionType = 'SILENCIADO' | 'EXPULSADO';

export async function listSanctions(auctionId: string) {
  return db.query.auctionSanctions.findMany({
    where: eq(auctionSanctions.auctionId, auctionId),
    orderBy: (s, { desc }) => desc(s.createdAt),
    with: { user: { columns: { firstName: true, lastName: true } } },
  });
}

export async function addSanction(auctionId: string, userId: string, type: SanctionType, createdById: string) {
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!target) throw Errors.notFound('Usuario');
  if (target.role !== 'USER') throw Errors.badRequest('No se puede sancionar al martillero ni a un administrador');

  const [sanction] = await db
    .insert(auctionSanctions)
    .values({ auctionId, userId, type, createdById })
    .onConflictDoNothing()
    .returning();
  // Ya estaba sancionado así: se devuelve la existente
  if (!sanction) {
    const [existing] = await db
      .select()
      .from(auctionSanctions)
      .where(
        and(eq(auctionSanctions.auctionId, auctionId), eq(auctionSanctions.userId, userId), eq(auctionSanctions.type, type))
      );
    return existing;
  }
  return sanction;
}

export async function removeSanction(auctionId: string, sanctionId: string) {
  const [removed] = await db
    .delete(auctionSanctions)
    .where(and(eq(auctionSanctions.id, sanctionId), eq(auctionSanctions.auctionId, auctionId)))
    .returning();
  if (!removed) throw Errors.notFound('Sanción');
  return removed;
}

export async function hasSanction(auctionId: string, userId: string, type: SanctionType) {
  const [row] = await db
    .select({ id: auctionSanctions.id })
    .from(auctionSanctions)
    .where(
      and(eq(auctionSanctions.auctionId, auctionId), eq(auctionSanctions.userId, userId), eq(auctionSanctions.type, type))
    );
  return Boolean(row);
}

import { desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { bids, lots, purchases } from '../db/schema';
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

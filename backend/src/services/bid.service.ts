import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { bids, lots, users } from '../db/schema';
import { Errors } from '../utils/AppError';

/**
 * Registra una puja sobre un lote.
 *
 * Usa optimistic locking (UPDATE ... WHERE id = ? AND current_price = ?)
 * dentro de una transacción: si dos usuarios pujan al mismo tiempo, solo
 * uno de los dos UPDATE afecta una fila (el otro afecta 0 filas porque el
 * precio ya cambió) y ahí reintentamos. Esto evita el clásico bug de
 * "pujas fantasma" en subastas en vivo con alta concurrencia sin tener que
 * tomar un lock pesado de tabla.
 */
export async function placeBid(lotId: string, userId: string, amount: number) {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const lot = await db.query.lots.findFirst({ where: eq(lots.id, lotId), with: { auction: true } });
    if (!lot) throw Errors.notFound('Lote');
    if (lot.auction.status !== 'ACTIVA') {
      throw Errors.badRequest('Esta subasta no está activa en este momento');
    }
    if (lot.sold) throw Errors.badRequest('Este lote ya fue adjudicado');

    const currentPrice = Number(lot.currentPrice);
    const minNext = currentPrice + Number(lot.bidIncrement);
    if (amount < minNext) {
      throw Errors.badRequest(`La puja mínima es $${minNext}`);
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw Errors.unauthorized();
    if (Number(user.creditBalance) < amount) {
      throw Errors.badRequest('No tenés crédito suficiente para esta puja. Cargá saldo en /creditos');
    }

    const result = await db.transaction(async (tx) => {
      const updatedRows = await tx
        .update(lots)
        .set({ currentPrice: String(amount), updatedAt: new Date() })
        .where(and(eq(lots.id, lotId), eq(lots.currentPrice, lot.currentPrice)))
        .returning();

      if (updatedRows.length === 0) {
        // Alguien más pujó justo antes que nosotros: abortamos este intento
        // para reintentar con el precio actualizado (fuera de la tx).
        return null;
      }

      const [bid] = await tx.insert(bids).values({ lotId, userId, amount: String(amount) }).returning();
      return { bid, lot: updatedRows[0] };
    });

    if (result) return result;
    // result === null → reintentar el for con el precio nuevo
  }

  throw Errors.conflict('Hubo mucha actividad en este lote, intentá pujar de nuevo');
}

export async function listBidsForLot(lotId: string) {
  return db.query.bids.findMany({
    where: eq(bids.lotId, lotId),
    orderBy: (b, { desc }) => desc(b.createdAt),
    with: { user: { columns: { firstName: true, lastName: true } } },
    limit: 50,
  });
}

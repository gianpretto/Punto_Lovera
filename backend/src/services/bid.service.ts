import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { bids, lots, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { getCurrentLot } from './auction.service';
import { getHeldCredit } from './credit.service';
import { isProfileComplete } from './auth.service';

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Registra una puja sobre un lote.
 *
 * Usa optimistic locking (UPDATE ... WHERE id = ? AND current_price = ?)
 * dentro de una transacción: si dos usuarios pujan al mismo tiempo, solo
 * uno de los dos UPDATE afecta una fila (el otro afecta 0 filas porque el
 * precio ya cambió) y ahí reintentamos. Esto evita el clásico bug de
 * "pujas fantasma" en subastas en vivo con alta concurrencia sin tener que
 * tomar un lock pesado de tabla.
 *
 * Crédito: la puja reserva su monto mientras el usuario va ganando. Se
 * valida contra el saldo disponible (saldo - lo reservado en OTROS lotes
 * que lidera; si ya lideraba este lote, su reserva anterior se reemplaza
 * por la nueva). La fila del usuario se bloquea (FOR UPDATE) dentro de la
 * transacción para que dos pujas simultáneas en lotes distintos no puedan
 * usar la misma plata dos veces.
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
    const current = await getCurrentLot(lot.auctionId);
    if (current?.id !== lot.id) {
      throw Errors.badRequest('Este lote no está en remate en este momento');
    }

    const currentPrice = Number(lot.currentPrice);
    const minNext = currentPrice + Number(lot.bidIncrement);
    if (amount < minNext) {
      throw Errors.badRequest(`La puja mínima es $${minNext}`);
    }

    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!user) throw Errors.unauthorized();
      if (!isProfileComplete(user)) {
        throw Errors.badRequest('Completá tus datos personales en "Mis datos" para poder ofertar');
      }

      const heldElsewhere = await getHeldCredit(userId, tx, lotId);
      const available = Number(user.creditBalance) - heldElsewhere;
      if (amount > available) {
        throw Errors.badRequest(
          heldElsewhere > 0
            ? `No tenés crédito disponible suficiente: te quedan ${pesos(available)} (tenés ${pesos(heldElsewhere)} reservados en lotes que vas ganando o reintegros pendientes). Cargá saldo en /creditos`
            : 'No tenés crédito suficiente para esta puja. Cargá saldo en /creditos'
        );
      }

      const updatedRows = await tx
        .update(lots)
        .set({ currentPrice: String(amount), leaderId: userId, updatedAt: new Date() })
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

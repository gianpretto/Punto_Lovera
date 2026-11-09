import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctionSanctions, bids, lots, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { getCurrentLot } from './auction.service';
import { getHeldCredit } from './credit.service';
import { isProfileComplete } from './auth.service';
import { env } from '../config/env';
import { factorDeCredito, getCreditConfig } from './settings.service';

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Próxima oferta mínima de un lote: la que fijó el martillero a mano (si
 * fijó una) o precio actual + incremento.
 */
export function minNextBidOf(lot: { currentPrice: string; bidIncrement: string; nextMinBid: string | null }) {
  if (lot.nextMinBid != null) return Number(lot.nextMinBid);
  return Number(lot.currentPrice) + Number(lot.bidIncrement);
}

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
 * Quien ya va ganando el lote no puede volver a ofertar (no tiene sentido
 * subirse el precio a uno mismo; pedido del cliente).
 *
 * Crédito: la puja reserva su monto mientras el usuario va ganando. Se
 * valida contra el saldo disponible (saldo - lo reservado en OTROS lotes
 * que lidera). La fila del usuario se bloquea (FOR UPDATE) dentro de la
 * transacción para que dos pujas simultáneas en lotes distintos no puedan
 * usar la misma plata dos veces.
 */
// Tope de una oferta: entra en decimal(12,2). Por HTTP lo valida zod; por
// el socket llega cualquier número.
const MAX_OFERTA = 9_999_999_999;

export async function placeBid(lotId: string, userId: string, amount: number) {
  const MAX_RETRIES = 3;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_OFERTA) {
    throw Errors.badRequest('Monto de oferta inválido');
  }

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

    if (lot.leaderId === userId) {
      throw Errors.badRequest('Ya vas ganando este lote: esperá a que alguien te supere para volver a ofertar');
    }

    const minNext = minNextBidOf(lot);
    if (amount < minNext) {
      // En la sala casi siempre es porque otro ofertó un instante antes
      throw Errors.badRequest(
        `Alguien ofertó antes que vos. La oferta mínima ahora es ${pesos(minNext)}: ya te la dejamos cargada, ofertá de nuevo.`
      );
    }

    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!user || user.deletedAt) throw Errors.unauthorized();
      // El martillero y los administradores conducen el remate: no ofertan
      if (user.role !== 'USER') {
        throw Errors.forbidden('El martillero y los administradores no pueden ofertar');
      }
      // El login no exige el mail verificado, pero ofertar sí: una puja
      // compromete plata y tiene que haber un mail real al que avisarle.
      if (!user.emailVerified && !env.skipEmailVerification) {
        throw Errors.badRequest(
          'Verificá tu mail para poder ofertar: revisá tu casilla (y spam) o pedí que te reenviemos el link'
        );
      }
      if (!isProfileComplete(user)) {
        throw Errors.badRequest('Completá tus datos personales en "Mis datos" para poder ofertar');
      }

      // Expulsado de este remate por el martillero
      const [expulsado] = await tx
        .select({ id: auctionSanctions.id })
        .from(auctionSanctions)
        .where(
          and(
            eq(auctionSanctions.auctionId, lot.auctionId),
            eq(auctionSanctions.userId, userId),
            eq(auctionSanctions.type, 'EXPULSADO')
          )
        );
      if (expulsado) throw Errors.forbidden('El martillero te expulsó de este remate');

      // Crédito según el modo que eligió el admin: todo el monto (CREDITO),
      // un % como garantía (GARANTIA) o nada (SIN_CREDITO)
      const config = await getCreditConfig(tx);
      const factor = factorDeCredito(config);
      if (factor > 0) {
        const needed = Math.ceil(amount * factor);
        const heldElsewhere = await getHeldCredit(userId, tx, lotId);
        const available = Number(user.creditBalance) - heldElsewhere;
        if (needed > available) {
          if (config.modo === 'GARANTIA') {
            throw Errors.badRequest(
              `Para esta oferta necesitás una garantía de ${pesos(needed)} (${config.porcentajeGarantia} % de la oferta) y tenés ${pesos(Math.max(available, 0))} disponibles. Cargá saldo en /creditos`
            );
          }
          throw Errors.badRequest(
            heldElsewhere > 0
              ? `No tenés crédito disponible suficiente: te quedan ${pesos(available)} (tenés ${pesos(heldElsewhere)} reservados en lotes que vas ganando o reintegros pendientes). Cargá saldo en /creditos`
              : 'No tenés crédito suficiente para esta puja. Cargá saldo en /creditos'
          );
        }
      }

      const updatedRows = await tx
        .update(lots)
        .set({ currentPrice: String(amount), leaderId: userId, nextMinBid: null, updatedAt: new Date() })
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

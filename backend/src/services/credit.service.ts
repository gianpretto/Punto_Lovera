import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, lots, users } from '../db/schema';

/**
 * Créditos "reservados" (hold): mientras un usuario va ganando un lote,
 * el precio actual de ese lote queda reservado de su saldo. Cuando otro lo
 * supera se libera solo (cambia lots.leader_id) y cuando se adjudica se
 * descuenta de verdad del saldo (purchase.service).
 *
 * No hay tabla de reservas: se calcula a partir de los lotes que el
 * usuario lidera, así nunca puede quedar desincronizado.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

// Subastas finalizadas/canceladas no retienen crédito aunque hayan quedado
// lotes sin adjudicar.
const ESTADOS_QUE_RETIENEN = ['PROXIMA', 'ACTIVA'] as const;

export async function getHeldCredit(userId: string, exec: Executor = db, excludeLotId?: string): Promise<number> {
  const [row] = await exec
    .select({ total: sql<string>`coalesce(sum(${lots.currentPrice}), 0)` })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(
      and(
        eq(lots.leaderId, userId),
        eq(lots.sold, false),
        inArray(auctions.status, [...ESTADOS_QUE_RETIENEN]),
        excludeLotId ? ne(lots.id, excludeLotId) : undefined
      )
    );
  return Number(row?.total ?? 0);
}

export async function getCreditSummary(userId: string, exec: Executor = db) {
  const [user] = await exec.select({ balance: users.creditBalance }).from(users).where(eq(users.id, userId));
  const balance = Number(user?.balance ?? 0);
  const held = await getHeldCredit(userId, exec);
  return { balance, held, available: balance - held };
}

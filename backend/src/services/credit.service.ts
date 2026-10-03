import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, creditWithdrawals, lots, users } from '../db/schema';

/**
 * Créditos "reservados" (hold): mientras un usuario va ganando un lote,
 * el precio actual de ese lote queda reservado de su saldo. Cuando otro lo
 * supera se libera solo (cambia lots.leader_id) y cuando se adjudica se
 * descuenta de verdad del saldo (purchase.service).
 *
 * También queda reservado el monto de los reintegros PENDIENTES (el usuario
 * pidió que le devuelvan esa plata): así no la puede usar para pujar ni
 * pedirla dos veces. Se libera al rechazarlo o se descuenta al aprobarlo
 * (withdrawal.service).
 *
 * No hay tabla de reservas: se calcula a partir de los lotes que el
 * usuario lidera y de sus reintegros pendientes, así nunca puede quedar
 * desincronizado.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

// Subastas finalizadas/canceladas no retienen crédito aunque hayan quedado
// lotes sin adjudicar.
const ESTADOS_QUE_RETIENEN = ['PROXIMA', 'ACTIVA'] as const;

/** Reservado en lotes que lidera (excludeLotId: no contar ese lote). */
async function getHeldInLots(userId: string, exec: Executor, excludeLotId?: string): Promise<number> {
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

/** Reservado por reintegros pendientes (cuenta siempre, se puje donde se puje). */
async function getHeldInWithdrawals(userId: string, exec: Executor): Promise<number> {
  const [row] = await exec
    .select({ total: sql<string>`coalesce(sum(${creditWithdrawals.amount}), 0)` })
    .from(creditWithdrawals)
    .where(and(eq(creditWithdrawals.userId, userId), eq(creditWithdrawals.status, 'PENDIENTE')));
  return Number(row?.total ?? 0);
}

/**
 * Total reservado del saldo: lotes que va ganando + reintegros pendientes.
 * excludeLotId solo excluye la reserva de ese lote (bid.service lo usa
 * porque la puja nueva reemplaza la anterior en el mismo lote).
 */
export async function getHeldCredit(userId: string, exec: Executor = db, excludeLotId?: string): Promise<number> {
  // En serie: dentro de una transacción comparten la misma conexión
  const inLots = await getHeldInLots(userId, exec, excludeLotId);
  const inWithdrawals = await getHeldInWithdrawals(userId, exec);
  return inLots + inWithdrawals;
}

export async function getCreditSummary(userId: string, exec: Executor = db) {
  const [user] = await exec.select({ balance: users.creditBalance }).from(users).where(eq(users.id, userId));
  const balance = Number(user?.balance ?? 0);
  const held = await getHeldCredit(userId, exec);
  return { balance, held, available: balance - held };
}

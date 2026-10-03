import { and, eq, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { creditWithdrawals, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { getHeldCredit } from './credit.service';
import { sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail } from './mail.service';

/**
 * Reintegros: el usuario pide que le devuelvan crédito que no usó.
 *
 * - Al pedirlo, el monto queda reservado (credit.service suma los
 *   reintegros PENDIENTES en getHeldCredit): no se puede pujar con esa
 *   plata ni pedirla dos veces.
 * - El admin transfiere por fuera de la plataforma (no hay pasarela de
 *   pago) y lo aprueba: recién ahí se descuenta del saldo.
 * - Si lo rechaza, la reserva se libera sola (deja de estar PENDIENTE).
 */

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

async function emailOf(userId: string) {
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return u?.email;
}

// Un mail que falla no tiene que deshacer la aprobación/rechazo
async function notify(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error('No se pudo enviar el mail del reintegro:', err);
  }
}

export async function requestWithdrawal(
  userId: string,
  data: { amount: number; cbu: string; alias: string | null; reason: string | null }
) {
  return db.transaction(async (tx) => {
    // Fila del usuario bloqueada (como en bid.service): dos pedidos
    // simultáneos, o un pedido y una puja, se ejecutan de a uno, así no se
    // puede usar/pedir la misma plata dos veces.
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user) throw Errors.unauthorized();

    const held = await getHeldCredit(userId, tx);
    const available = Number(user.creditBalance) - held;
    if (data.amount > available) {
      throw Errors.badRequest(
        available > 0
          ? `Podés pedir hasta ${pesos(available)} (tu crédito disponible${held > 0 ? `; tenés ${pesos(held)} reservados en lotes que vas ganando o reintegros pendientes` : ''})`
          : 'No tenés crédito disponible para reintegrar'
      );
    }

    const [withdrawal] = await tx
      .insert(creditWithdrawals)
      .values({ userId, amount: String(data.amount), cbu: data.cbu, alias: data.alias, reason: data.reason })
      .returning();
    return withdrawal;
  });
}

export async function listMyWithdrawals(userId: string) {
  return db.query.creditWithdrawals.findMany({
    where: eq(creditWithdrawals.userId, userId),
    orderBy: (w, { desc }) => desc(w.createdAt),
  });
}

export async function listPendingWithdrawals() {
  return db.query.creditWithdrawals.findMany({
    where: eq(creditWithdrawals.status, 'PENDIENTE'),
    orderBy: (w, { asc }) => asc(w.createdAt),
    with: { user: { columns: { firstName: true, lastName: true, email: true, dni: true } } },
  });
}

export async function approveWithdrawal(withdrawalId: string, reviewerId: string) {
  const [withdrawal] = await db.select().from(creditWithdrawals).where(eq(creditWithdrawals.id, withdrawalId));
  if (!withdrawal) throw Errors.notFound('Reintegro');
  if (withdrawal.status !== 'PENDIENTE') throw Errors.badRequest('Este reintegro ya fue revisado');

  // Transacción: marcar el reintegro como aprobado y descontar el saldo
  // tienen que pasar juntos o no pasar ninguno de los dos.
  const result = await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, withdrawal.userId)).for('update');

    const [updated] = await tx
      .update(creditWithdrawals)
      .set({ status: 'APROBADO', reviewedById: reviewerId, reviewedAt: new Date() })
      // status en el WHERE: si dos admins aprueban a la vez, solo uno descuenta
      .where(and(eq(creditWithdrawals.id, withdrawalId), eq(creditWithdrawals.status, 'PENDIENTE')))
      .returning();
    if (!updated) throw Errors.badRequest('Este reintegro ya fue revisado');

    // El monto estaba reservado mientras estaba pendiente; ahora se descuenta
    // de verdad (y la reserva desaparece porque dejó de estar PENDIENTE).
    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} - ${withdrawal.amount}`, updatedAt: new Date() })
      .where(eq(users.id, withdrawal.userId));

    return updated;
  });

  const email = await emailOf(withdrawal.userId);
  if (email) await notify(() => sendWithdrawalApprovedEmail(email, Number(withdrawal.amount)));
  return result;
}

export async function rejectWithdrawal(withdrawalId: string, reviewerId: string, reason: string) {
  const [withdrawal] = await db.select().from(creditWithdrawals).where(eq(creditWithdrawals.id, withdrawalId));
  if (!withdrawal) throw Errors.notFound('Reintegro');
  if (withdrawal.status !== 'PENDIENTE') throw Errors.badRequest('Este reintegro ya fue revisado');

  // Rechazar no toca el saldo: solo deja de estar PENDIENTE y con eso se
  // libera la reserva.
  const [updated] = await db
    .update(creditWithdrawals)
    .set({ status: 'RECHAZADO', reviewedById: reviewerId, reviewedAt: new Date(), rejectionReason: reason })
    .where(and(eq(creditWithdrawals.id, withdrawalId), eq(creditWithdrawals.status, 'PENDIENTE')))
    .returning();
  if (!updated) throw Errors.badRequest('Este reintegro ya fue revisado');

  const email = await emailOf(withdrawal.userId);
  if (email) await notify(() => sendWithdrawalRejectedEmail(email, Number(withdrawal.amount), reason));
  return updated;
}

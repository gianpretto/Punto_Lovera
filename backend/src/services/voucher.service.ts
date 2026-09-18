import { eq, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { creditVouchers, users } from '../db/schema';
import { Errors } from '../utils/AppError';

export async function submitVoucher(userId: string, amount: number, fileUrl: string) {
  const [voucher] = await db
    .insert(creditVouchers)
    .values({ userId, amount: String(amount), fileUrl })
    .returning();
  return voucher;
}

export async function listMyVouchers(userId: string) {
  return db.query.creditVouchers.findMany({
    where: eq(creditVouchers.userId, userId),
    orderBy: (v, { desc }) => desc(v.createdAt),
  });
}

export async function listPendingVouchers() {
  return db.query.creditVouchers.findMany({
    where: eq(creditVouchers.status, 'PENDIENTE'),
    orderBy: (v, { asc }) => asc(v.createdAt),
    with: { user: { columns: { firstName: true, lastName: true, email: true } } },
  });
}

export async function approveVoucher(voucherId: string, reviewerId: string) {
  const [voucher] = await db.select().from(creditVouchers).where(eq(creditVouchers.id, voucherId));
  if (!voucher) throw Errors.notFound('Comprobante');
  if (voucher.status !== 'PENDIENTE') throw Errors.badRequest('Este comprobante ya fue revisado');

  // Transacción: aprobar el comprobante y acreditar el saldo tienen que
  // pasar juntos o no pasar ninguno de los dos.
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(creditVouchers)
      .set({ status: 'APROBADO', reviewedById: reviewerId, reviewedAt: new Date() })
      .where(eq(creditVouchers.id, voucherId))
      .returning();

    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${voucher.amount}` })
      .where(eq(users.id, voucher.userId));

    return updated;
  });
}

export async function rejectVoucher(voucherId: string, reviewerId: string, reason: string) {
  const [voucher] = await db.select().from(creditVouchers).where(eq(creditVouchers.id, voucherId));
  if (!voucher) throw Errors.notFound('Comprobante');
  if (voucher.status !== 'PENDIENTE') throw Errors.badRequest('Este comprobante ya fue revisado');

  const [updated] = await db
    .update(creditVouchers)
    .set({ status: 'RECHAZADO', reviewedById: reviewerId, reviewedAt: new Date(), rejectionReason: reason })
    .where(eq(creditVouchers.id, voucherId))
    .returning();
  return updated;
}

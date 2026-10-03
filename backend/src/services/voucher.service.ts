import { and, eq, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { creditVouchers, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { sendVoucherApprovedEmail, sendVoucherRejectedEmail } from './mail.service';

async function emailOf(userId: string) {
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return u?.email;
}

// Un mail que falla no tiene que deshacer la aprobación/rechazo
async function notify(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error('No se pudo enviar el mail del comprobante:', err);
  }
}

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
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(creditVouchers)
      .set({ status: 'APROBADO', reviewedById: reviewerId, reviewedAt: new Date() })
      // status en el WHERE: si dos admins aprueban a la vez, solo uno acredita
      .where(and(eq(creditVouchers.id, voucherId), eq(creditVouchers.status, 'PENDIENTE')))
      .returning();
    if (!updated) throw Errors.badRequest('Este comprobante ya fue revisado');

    await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${voucher.amount}` })
      .where(eq(users.id, voucher.userId));

    return updated;
  });

  const email = await emailOf(voucher.userId);
  if (email) await notify(() => sendVoucherApprovedEmail(email, Number(voucher.amount)));
  return result;
}

export async function rejectVoucher(voucherId: string, reviewerId: string, reason: string) {
  const [voucher] = await db.select().from(creditVouchers).where(eq(creditVouchers.id, voucherId));
  if (!voucher) throw Errors.notFound('Comprobante');
  if (voucher.status !== 'PENDIENTE') throw Errors.badRequest('Este comprobante ya fue revisado');

  const [updated] = await db
    .update(creditVouchers)
    .set({ status: 'RECHAZADO', reviewedById: reviewerId, reviewedAt: new Date(), rejectionReason: reason })
    .where(and(eq(creditVouchers.id, voucherId), eq(creditVouchers.status, 'PENDIENTE')))
    .returning();
  if (!updated) throw Errors.badRequest('Este comprobante ya fue revisado');

  const email = await emailOf(voucher.userId);
  if (email) await notify(() => sendVoucherRejectedEmail(email, Number(voucher.amount), reason));
  return updated;
}

/** Comprobante para ver el archivo: solo el dueño o un admin. */
export async function getVoucherForViewer(voucherId: string, viewer: { userId: string; role: string }) {
  const [voucher] = await db.select().from(creditVouchers).where(eq(creditVouchers.id, voucherId));
  if (!voucher) throw Errors.notFound('Comprobante');
  if (voucher.userId !== viewer.userId && viewer.role !== 'ADMIN') throw Errors.forbidden();
  return voucher;
}

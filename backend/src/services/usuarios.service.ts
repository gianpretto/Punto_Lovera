import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, bids, lots, purchases, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import { isProfileComplete } from './auth.service';
import { forgetSession } from './session.service';
import { getHeldCredit } from './credit.service';

/**
 * Base de personas para el martillero/admin (pedido del cliente, nov 2026):
 * lista con filtros, ficha con datos editables y sus compras en los remates.
 */

type Rol = 'USER' | 'MARTILLERO' | 'ADMIN';

export interface FiltrosUsuarios {
  q?: string;
  rol?: Rol;
  /** completos: datos completos para ofertar; incompletos: les falta algo */
  datos?: 'completos' | 'incompletos';
  /** con compras en algún remate */
  compradores?: boolean;
  bajas?: boolean;
  page: number;
  pageSize: number;
}

// Columnas que se muestran (nunca hashes ni tokens)
const COLUMNAS = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  phoneAreaCode: users.phoneAreaCode,
  phone: users.phone,
  phoneVerified: users.phoneVerified,
  dni: users.dni,
  birthDate: users.birthDate,
  address: users.address,
  city: users.city,
  province: users.province,
  zipCode: users.zipCode,
  role: users.role,
  emailVerified: users.emailVerified,
  creditBalance: users.creditBalance,
  createdAt: users.createdAt,
  deletedAt: users.deletedAt,
};

const compras = sql<number>`(select count(*)::int from ${purchases} where ${purchases.userId} = ${users.id})`;

// Para filtrar "datos completos" en la base (misma regla que isProfileComplete,
// sin el SKIP_PHONE_VERIFICATION de pruebas)
const completos = sql`(${users.dni} is not null and ${users.dni} <> '' and ${users.phone} is not null and ${users.phoneVerified})`;

export async function listUsers(f: FiltrosUsuarios) {
  const condiciones: (SQL | undefined)[] = [f.bajas ? isNotNull(users.deletedAt) : isNull(users.deletedAt)];
  if (f.q) {
    const t = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const digitos = f.q.replace(/\D/g, '');
    condiciones.push(
      or(
        ilike(users.email, t),
        ilike(users.firstName, t),
        ilike(users.lastName, t),
        ilike(sql`${users.firstName} || ' ' || ${users.lastName}`, t),
        digitos.length >= 3 ? ilike(users.dni, `%${digitos}%`) : undefined,
        digitos.length >= 3 ? ilike(sql`coalesce(${users.phoneAreaCode}, '') || ${users.phone}`, `%${digitos}%`) : undefined
      )
    );
  }
  if (f.rol) condiciones.push(eq(users.role, f.rol));
  if (f.datos === 'completos') condiciones.push(completos);
  if (f.datos === 'incompletos') condiciones.push(sql`not ${completos}`);
  if (f.compradores) condiciones.push(sql`${compras} > 0`);
  const where = and(...condiciones);

  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const rows = await db
    .select({ ...COLUMNAS, compras })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);

  return {
    users: rows.map((u) => ({ ...u, creditBalance: Number(u.creditBalance) })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pages: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

/** Ficha: datos, crédito, compras y lotes en los que ofertó. */
export async function getUserDetail(id: string) {
  const [user] = await db.select(COLUMNAS).from(users).where(eq(users.id, id));
  if (!user) throw Errors.notFound('Usuario');
  const [full] = await db.select().from(users).where(eq(users.id, id));

  const susCompras = await db
    .select({
      id: purchases.id,
      reference: purchases.reference,
      totalAmount: purchases.totalAmount,
      createdAt: purchases.createdAt,
      lotNumber: lots.number,
      lotBis: lots.bis,
      lotTitle: lots.title,
      auctionId: auctions.id,
      auctionTitle: auctions.title,
      auctionStartsAt: auctions.startsAt,
    })
    .from(purchases)
    .innerJoin(lots, eq(purchases.lotId, lots.id))
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(eq(purchases.userId, id))
    .orderBy(desc(purchases.createdAt));

  const ofertas = await db
    .select({
      lotId: lots.id,
      lotNumber: lots.number,
      lotBis: lots.bis,
      lotTitle: lots.title,
      auctionTitle: auctions.title,
      bids: count(bids.id),
      maxAmount: sql<string>`max(${bids.amount})`,
      lastAt: sql<Date>`max(${bids.createdAt})`,
    })
    .from(bids)
    .innerJoin(lots, eq(bids.lotId, lots.id))
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(eq(bids.userId, id), isNull(bids.voidedAt)))
    .groupBy(lots.id, auctions.id)
    .orderBy(desc(sql`max(${bids.createdAt})`))
    .limit(50);

  const held = await getHeldCredit(id);
  return {
    user: {
      ...user,
      creditBalance: Number(user.creditBalance),
      heldCredit: held,
      profileComplete: isProfileComplete(full),
    },
    purchases: susCompras.map((c) => ({ ...c, totalAmount: Number(c.totalAmount) })),
    offers: ofertas.map((o) => ({ ...o, maxAmount: Number(o.maxAmount) })),
  };
}

export type CambiosUsuario = Partial<{
  firstName: string;
  lastName: string;
  dni: string | null;
  phoneAreaCode: string | null;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  birthDate: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zipCode: string | null;
  role: Rol;
}>;

/**
 * Editar los datos de una persona. El rol solo lo cambia un ADMIN, y nadie
 * se saca a sí mismo el rol (para no quedarse afuera). El saldo de crédito
 * no se toca acá: se mueve con comprobantes y reintegros.
 */
export async function updateUser(id: string, cambios: CambiosUsuario, editor: { userId: string; role: Rol }) {
  const [actual] = await db.select().from(users).where(eq(users.id, id));
  if (!actual) throw Errors.notFound('Usuario');
  if (actual.deletedAt) throw Errors.badRequest('Esta cuenta fue dada de baja');

  if (cambios.role !== undefined && cambios.role !== actual.role) {
    if (editor.role !== 'ADMIN') throw Errors.forbidden('Solo un administrador puede cambiar el rol');
    if (id === editor.userId) throw Errors.badRequest('No podés cambiarte el rol a vos mismo');
  }
  // Un martillero no edita a un admin
  if (editor.role !== 'ADMIN' && actual.role === 'ADMIN') {
    throw Errors.forbidden('Solo un administrador puede editar a otro administrador');
  }

  const [updated] = await db
    .update(users)
    .set({ ...cambios, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (cambios.role !== undefined) forgetSession(id); // el rol nuevo vale enseguida
  return getUserDetail(updated.id);
}

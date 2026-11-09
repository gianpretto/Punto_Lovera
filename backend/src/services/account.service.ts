import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, creditVouchers, creditWithdrawals, lots, users } from '../db/schema';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';
import { hashToken } from '../utils/tokens';
import { publicUserWithCredit } from './auth.service';
import { revokeSessions } from './session.service';
import { sendPhoneCode } from './whatsapp.service';

// ---------- Celular (verificación por WhatsApp) ----------

const PHONE_CODE_TTL_MS = 10 * 60 * 1000; // el código vence a los 10 minutos
const PHONE_CODE_MAX_ATTEMPTS = 5;

// El hash incluye el id del usuario: el mismo código de dos personas da
// hashes distintos (y no se puede probar contra otra cuenta)
const hashCode = (userId: string, code: string) => hashToken(`${userId}:${code}`);

/**
 * Guarda el celular (queda sin verificar) y manda un código de 6 números
 * por WhatsApp. Cambiar el número obliga a verificarlo de nuevo.
 */
export async function setPhone(userId: string, areaCode: string, phone: string) {
  const [actual] = await db.select().from(users).where(eq(users.id, userId));
  if (!actual || actual.deletedAt) throw Errors.notFound('Usuario');

  // Entorno de prueba (SKIP_PHONE_VERIFICATION): queda verificado sin mandar nada
  if (env.skipPhoneVerification) {
    const [user] = await db
      .update(users)
      .set({ phoneAreaCode: areaCode, phone, phoneVerified: true, phoneCodeHash: null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return { user: await publicUserWithCredit(user), codeSent: false };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const [user] = await db
    .update(users)
    .set({
      phoneAreaCode: areaCode,
      phone,
      phoneVerified: false,
      phoneCodeHash: hashCode(userId, code),
      phoneCodeExpiry: new Date(Date.now() + PHONE_CODE_TTL_MS),
      phoneCodeAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  try {
    await sendPhoneCode(areaCode + phone, code);
  } catch {
    throw Errors.badRequest('No pudimos mandarte el código por WhatsApp. Revisá el número y probá de nuevo.');
  }
  return { user: await publicUserWithCredit(user), codeSent: true };
}

export async function verifyPhone(userId: string, code: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.deletedAt) throw Errors.notFound('Usuario');
  if (user.phoneVerified) return publicUserWithCredit(user);
  if (!user.phoneCodeHash || !user.phoneCodeExpiry || user.phoneCodeExpiry < new Date()) {
    throw Errors.badRequest('El código venció: pedí uno nuevo');
  }
  if (user.phoneCodeAttempts >= PHONE_CODE_MAX_ATTEMPTS) {
    throw Errors.badRequest('Demasiados intentos con este código: pedí uno nuevo');
  }

  if (hashCode(userId, code) !== user.phoneCodeHash) {
    await db
      .update(users)
      .set({ phoneCodeAttempts: sql`${users.phoneCodeAttempts} + 1` })
      .where(eq(users.id, userId));
    throw Errors.badRequest('El código no es correcto');
  }

  const [verified] = await db
    .update(users)
    .set({ phoneVerified: true, phoneCodeHash: null, phoneCodeExpiry: null, phoneCodeAttempts: 0, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return publicUserWithCredit(verified);
}

// ---------- Baja de la cuenta ----------

/**
 * El usuario da de baja su cuenta. No se borra la fila (sus pujas y compras
 * son registros del remate): se borran los datos personales, el mail pasa a
 * uno inventado (así puede volver a registrarse con el suyo) y ya no puede
 * entrar. No se puede mientras tenga algo en curso con plata de por medio.
 */
export async function deleteAccount(userId: string, password: string | undefined) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.deletedAt) throw Errors.notFound('Usuario');
  if (user.role !== 'USER') {
    throw Errors.badRequest('Las cuentas de martillero o administrador no se dan de baja desde acá');
  }

  // Las cuentas con contraseña la confirman (las de Google no tienen)
  if (user.passwordHash && !(await bcrypt.compare(password ?? '', user.passwordHash))) {
    throw Errors.badRequest('La contraseña no es correcta');
  }

  if (Number(user.creditBalance) > 0) {
    throw Errors.badRequest('Todavía tenés crédito cargado: pedí el reintegro antes de dar de baja la cuenta');
  }
  const [liderando] = await db
    .select({ id: lots.id })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(eq(lots.leaderId, userId), eq(lots.sold, false), inArray(auctions.status, ['PROXIMA', 'ACTIVA'])))
    .limit(1);
  if (liderando) throw Errors.badRequest('Vas ganando un lote en un remate en curso: esperá a que termine');

  const [comprobante] = await db
    .select({ id: creditVouchers.id })
    .from(creditVouchers)
    .where(and(eq(creditVouchers.userId, userId), eq(creditVouchers.status, 'PENDIENTE')))
    .limit(1);
  const [reintegro] = await db
    .select({ id: creditWithdrawals.id })
    .from(creditWithdrawals)
    .where(and(eq(creditWithdrawals.userId, userId), eq(creditWithdrawals.status, 'PENDIENTE')))
    .limit(1);
  if (comprobante || reintegro) {
    throw Errors.badRequest('Tenés un comprobante o un reintegro pendiente de revisión: esperá a que se resuelva');
  }

  await db
    .update(users)
    .set({
      email: `baja-${user.id}@cuenta-eliminada.invalid`,
      passwordHash: null,
      googleId: null,
      firstName: 'Usuario',
      lastName: 'dado de baja',
      phone: null,
      phoneAreaCode: null,
      phoneVerified: false,
      phoneCodeHash: null,
      phoneCodeExpiry: null,
      dni: null,
      birthDate: null,
      address: null,
      city: null,
      province: null,
      zipCode: null,
      verificationToken: null,
      resetToken: null,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  await revokeSessions(userId);
}

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { users } from '../db/schema';
import { signToken } from '../utils/jwt';
import { randomToken } from '../utils/tokens';
import { Errors } from '../utils/AppError';
import { sendPasswordResetEmail, sendVerificationEmail } from './mail.service';

const SALT_ROUNDS = 10;

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dni?: string;
}

type UserRow = typeof users.$inferSelect;

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dni: user.dni,
    birthDate: user.birthDate,
    address: user.address,
    city: user.city,
    province: user.province,
    zipCode: user.zipCode,
    role: user.role,
    emailVerified: user.emailVerified,
    creditBalance: Number(user.creditBalance),
  };
}

export async function register(input: RegisterInput) {
  const [existing] = await db.select().from(users).where(eq(users.email, input.email));
  if (existing) throw Errors.conflict('Ya existe una cuenta con ese email');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const verificationToken = randomToken();

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      dni: input.dni,
      verificationToken,
      verificationSentAt: new Date(),
    })
    .returning();

  await sendVerificationEmail(user.email, verificationToken);

  return publicUser(user);
}

export async function login(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw Errors.badRequest('Email o contraseña incorrectos');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Errors.badRequest('Email o contraseña incorrectos');

  const token = signToken({ userId: user.id, role: user.role });
  return { token, user: publicUser(user) };
}

export async function verifyEmail(token: string) {
  const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
  if (!user) throw Errors.badRequest('Link de verificación inválido o ya usado');

  await db
    .update(users)
    .set({ emailVerified: true, verificationToken: null })
    .where(eq(users.id, user.id));
}

export async function resendVerification(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  // Igual que en recuperar contraseña: no revelamos si el mail existe.
  if (!user || user.emailVerified) return;

  const verificationToken = randomToken();
  await db
    .update(users)
    .set({ verificationToken, verificationSentAt: new Date() })
    .where(eq(users.id, user.id));

  await sendVerificationEmail(user.email, verificationToken);
}

export async function requestPasswordReset(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  // No revelamos si el mail existe o no (evita enumeración de usuarios).
  if (!user) return;

  const resetToken = randomToken();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await db.update(users).set({ resetToken, resetTokenExpiry }).where(eq(users.id, user.id));

  await sendPasswordResetEmail(user.email, resetToken);
}

export async function resetPassword(token: string, newPassword: string) {
  const [user] = await db.select().from(users).where(eq(users.resetToken, token));
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    throw Errors.badRequest('Link de recuperación inválido o vencido');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, user.id));
}

export async function getMe(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw Errors.notFound('Usuario');
  return publicUser(user);
}

export type UpdateProfileInput = Partial<{
  firstName: string;
  lastName: string;
  phone: string;
  dni: string;
  birthDate: string;
  address: string;
  city: string;
  province: string;
  zipCode: string;
}>;

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // '' => null, así el usuario puede borrar un campo opcional
  const values = Object.fromEntries(
    Object.entries(input)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, v === '' ? null : v])
  );

  const [user] = await db
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw Errors.notFound('Usuario');
  return publicUser(user);
}

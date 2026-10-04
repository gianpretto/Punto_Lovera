import { z } from 'zod';

// Los mails se guardan y comparan siempre en minúsculas y sin espacios: así
// "Juan@mail.com" y "juan@mail.com" son la misma cuenta (no se puede
// registrar dos veces el mismo mail).
const email = (msg?: string) => z.string().trim().toLowerCase().email(msg);

// bcrypt solo usa los primeros 72 bytes: más largo daría una falsa seguridad
const newPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'La contraseña puede tener como máximo 72 caracteres');

export const registerSchema = z.object({
  email: email('Email inválido'),
  password: newPassword,
  firstName: z.string().min(1, 'Falta el nombre'),
  lastName: z.string().min(1, 'Falta el apellido'),
  phone: z.string().optional(),
  dni: z.string().optional(),
});

export const loginSchema = z.object({
  email: email(),
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: newPassword,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: email(),
});

const soloNumeros = z.string().regex(/^[0-9]*$/, 'Solo números');

// Todos opcionales: el front manda solo lo que se editó en /datos.
// '' se acepta y se guarda como null (campo borrado).
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'Falta el nombre').optional(),
  lastName: z.string().trim().min(1, 'Falta el apellido').optional(),
  phone: soloNumeros.optional(),
  dni: soloNumeros.optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
    .or(z.literal(''))
    .optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  province: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
});

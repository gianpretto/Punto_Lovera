import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(1, 'Falta el nombre'),
  lastName: z.string().min(1, 'Falta el apellido'),
  phone: z.string().optional(),
  dni: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
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

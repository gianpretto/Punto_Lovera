import { z } from 'zod';

export const submitVoucherSchema = z.object({
  amount: z.coerce.number().positive('El monto tiene que ser mayor a 0'),
});

export const rejectVoucherSchema = z.object({
  reason: z.string().min(1, 'Contá por qué se rechaza'),
});

// Pedido de reintegro (devolver crédito no usado a una cuenta bancaria)
export const requestWithdrawalSchema = z.object({
  amount: z.coerce.number().positive('El monto tiene que ser mayor a 0'),
  // Aceptamos espacios/guiones al pegarlo y guardamos solo los dígitos
  cbu: z
    .string({ required_error: 'Falta el CBU' })
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{22}$/, 'El CBU tiene que tener 22 dígitos')),
  alias: z
    .string()
    .trim()
    .max(60, 'El alias es demasiado largo')
    .optional()
    .transform((v) => v || null),
  reason: z
    .string()
    .trim()
    .max(500, 'El motivo es demasiado largo')
    .optional()
    .transform((v) => v || null),
});

export const rejectWithdrawalSchema = z.object({
  reason: z.string().trim().min(1, 'Contá por qué se rechaza'),
});

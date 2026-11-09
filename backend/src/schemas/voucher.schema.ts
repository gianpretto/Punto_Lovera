import { z } from 'zod';
import { cuit, LARGOS } from './comunes';

const monto = z.coerce
  .number()
  .positive('El monto tiene que ser mayor a 0')
  .max(9_999_999_999, 'Monto demasiado grande');

export const submitVoucherSchema = z.object({
  amount: monto,
});

export const rejectVoucherSchema = z.object({
  reason: z.string().trim().min(1, 'Contá por qué se rechaza').max(LARGOS.motivo, 'El motivo es demasiado largo'),
});

// Pedido de reintegro (devolver crédito no usado a una cuenta bancaria)
export const requestWithdrawalSchema = z.object({
  amount: monto,
  // Nombre que figura en la cuenta destino y su CUIT/CUIL (pedido del cliente)
  accountHolder: z
    .string({ error: 'Falta el nombre del titular' })
    .trim()
    .min(2, 'Falta el nombre del titular')
    .max(LARGOS.titular, 'El nombre del titular es demasiado largo'),
  cuit,
  // Aceptamos espacios/guiones al pegarlo y guardamos solo los dígitos
  cbu: z
    .string({ error: 'Falta el CBU' })
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{22}$/, 'El CBU tiene que tener 22 dígitos')),
  alias: z
    .string()
    .trim()
    .max(LARGOS.alias, 'El alias es demasiado largo')
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
  reason: z.string().trim().min(1, 'Contá por qué se rechaza').max(LARGOS.motivo, 'El motivo es demasiado largo'),
});

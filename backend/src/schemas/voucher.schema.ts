import { z } from 'zod';

export const submitVoucherSchema = z.object({
  amount: z.coerce.number().positive('El monto tiene que ser mayor a 0'),
});

export const rejectVoucherSchema = z.object({
  reason: z.string().min(1, 'Contá por qué se rechaza'),
});

import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Falta tu nombre').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1, 'Contanos qué querés consultar').max(3000),
  source: z.string().trim().max(40).optional(),
});

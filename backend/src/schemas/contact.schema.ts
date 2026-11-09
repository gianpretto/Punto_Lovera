import { z } from 'zod';
import { LARGOS } from './comunes';

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Falta tu nombre').max(120, 'El nombre es demasiado largo'),
  email: z.string().trim().toLowerCase().max(LARGOS.email, 'Email demasiado largo').email('Email inválido'),
  phone: z
    .string()
    .trim()
    .max(30, 'Teléfono demasiado largo')
    .regex(/^[0-9 +()-]*$/, 'El teléfono solo puede tener números')
    .optional(),
  message: z
    .string()
    .trim()
    .min(1, 'Contanos qué querés consultar')
    .max(LARGOS.mensaje, `El mensaje puede tener como máximo ${LARGOS.mensaje} caracteres`),
  source: z.string().trim().max(40).optional(),
});

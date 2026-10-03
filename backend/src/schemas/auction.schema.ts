import { z } from 'zod';

// Portada: una URL externa o una imagen ya subida al backend
// (POST /subastas/:id/portada la deja en /uploads/lots/...).
const coverImageUrl = z
  .string()
  .trim()
  .refine(
    (v) => /^\/uploads\/lots\/[\w.-]+$/.test(v) || /^https?:\/\/[^\s]+$/i.test(v),
    'La portada debe ser una URL válida'
  );

export const createAuctionSchema = z.object({
  title: z.string().trim().min(1, 'Indicá un título'),
  description: z.string().trim().min(1, 'Indicá una descripción'),
  location: z.string().trim().min(1, 'Indicá la ubicación'),
  startsAt: z.coerce.date({ invalid_type_error: 'Fecha de inicio inválida' }),
  coverImageUrl: coverImageUrl.optional(),
});

export const updateAuctionSchema = createAuctionSchema.partial().extend({
  // null = quitar la portada
  coverImageUrl: coverImageUrl.nullable().optional(),
  status: z.enum(['PROXIMA', 'ACTIVA', 'FINALIZADA', 'CANCELADA']).optional(),
});

export const createLotSchema = z.object({
  number: z.coerce.number().int('El número de lote debe ser entero').positive('El número de lote debe ser mayor a 0'),
  title: z.string().trim().min(1, 'Indicá un título para el lote'),
  description: z.string().trim().min(1, 'Indicá una descripción para el lote'),
  startingPrice: z.coerce.number().positive('El precio base debe ser mayor a 0'),
  bidIncrement: z.coerce.number().positive('El incremento de puja debe ser mayor a 0').optional(),
});

export const updateLotSchema = createLotSchema.partial();

export const placeBidSchema = z.object({
  amount: z.coerce.number().positive(),
});

export const setCurrentLotSchema = z.object({
  lotId: z.string().uuid().nullable(),
});

export const createPassSchema = z.object({
  label: z.string().trim().min(1, 'Indicá para quién es el pase').max(80),
  hours: z.coerce.number().int().min(1).max(24 * 14).default(24),
});

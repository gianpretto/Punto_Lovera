import { z } from 'zod';
import { LARGOS } from './comunes';

// Montos: hasta 9.999.999.999 (entra en decimal(12,2))
const monto = (msg: string) => z.coerce.number().positive(msg).max(9_999_999_999, 'Monto demasiado grande');

// Portada: una URL externa o una imagen ya subida al backend
// (POST /subastas/:id/portada la deja en /uploads/lots/...).
const coverImageUrl = z
  .string()
  .trim()
  .max(500, 'URL demasiado larga')
  .refine(
    (v) => /^\/uploads\/lots\/[\w.-]+$/.test(v) || /^https?:\/\/[^\s]+$/i.test(v),
    'La portada debe ser una URL válida'
  );

export const createAuctionSchema = z.object({
  title: z.string().trim().min(1, 'Indicá un título').max(LARGOS.titulo, `El título puede tener como máximo ${LARGOS.titulo} caracteres`),
  description: z
    .string()
    .trim()
    .min(1, 'Indicá una descripción')
    .max(LARGOS.descripcion, `La descripción puede tener como máximo ${LARGOS.descripcion} caracteres`),
  location: z.string().trim().min(1, 'Indicá la ubicación').max(LARGOS.textoCorto, 'La ubicación es demasiado larga'),
  startsAt: z.coerce.date({ error: 'Fecha de inicio inválida' }),
  coverImageUrl: coverImageUrl.optional(),
});

export const updateAuctionSchema = createAuctionSchema.partial().extend({
  // null = quitar la portada
  coverImageUrl: coverImageUrl.nullable().optional(),
  status: z.enum(['PROXIMA', 'ACTIVA', 'FINALIZADA', 'CANCELADA']).optional(),
});

export const createLotSchema = z.object({
  number: z.coerce
    .number()
    .int('El número de lote debe ser entero')
    .positive('El número de lote debe ser mayor a 0')
    .max(100_000, 'Número de lote demasiado grande'),
  title: z
    .string()
    .trim()
    .min(1, 'Indicá un título para el lote')
    .max(LARGOS.titulo, `El título puede tener como máximo ${LARGOS.titulo} caracteres`),
  description: z
    .string()
    .trim()
    .min(1, 'Indicá una descripción para el lote')
    .max(LARGOS.descripcion, `La descripción puede tener como máximo ${LARGOS.descripcion} caracteres`),
  startingPrice: monto('El precio base debe ser mayor a 0'),
  bidIncrement: monto('El incremento de puja debe ser mayor a 0').optional(),
});

export const updateLotSchema = createLotSchema.partial();

export const placeBidSchema = z.object({
  amount: monto('La oferta tiene que ser mayor a 0'),
});

// Controles del martillero en vivo sobre el lote en remate (todo opcional):
// - currentPrice / leaderId: corregir el precio actual y quién va ganando
//   (leaderId tiene que ser alguien que ofertó en ese lote, o null = nadie)
// - bidIncrement: incremento de las próximas ofertas
// - nextMinBid: próxima oferta mínima a mano (null = volver a precio + incremento)
export const liveLotSchema = z
  .object({
    currentPrice: z.coerce.number().min(0, 'El precio no puede ser negativo').max(9_999_999_999).optional(),
    leaderId: z.string().uuid().nullable().optional(),
    bidIncrement: monto('El incremento tiene que ser mayor a 0').optional(),
    nextMinBid: monto('La oferta mínima tiene que ser mayor a 0').nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), 'No hay nada para cambiar');

export const sanctionSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['SILENCIADO', 'EXPULSADO']),
});

export const setCurrentLotSchema = z.object({
  lotId: z.string().uuid().nullable(),
});

export const createPassSchema = z.object({
  label: z.string().trim().min(1, 'Indicá para quién es el pase').max(80),
  hours: z.coerce.number().int().min(1).max(24 * 14).default(24),
});

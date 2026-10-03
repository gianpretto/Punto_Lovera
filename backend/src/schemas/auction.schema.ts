import { z } from 'zod';

export const createAuctionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  startsAt: z.coerce.date(),
  coverImageUrl: z.string().url().optional(),
});

export const updateAuctionSchema = createAuctionSchema.partial().extend({
  status: z.enum(['PROXIMA', 'ACTIVA', 'FINALIZADA', 'CANCELADA']).optional(),
});

export const createLotSchema = z.object({
  number: z.coerce.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  startingPrice: z.coerce.number().positive(),
  bidIncrement: z.coerce.number().positive().optional(),
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

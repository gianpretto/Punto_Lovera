import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import * as settingsService from '../services/settings.service';
import { cuit, LARGOS, texto } from '../schemas/comunes';

const creditosSchema = z
  .object({
    modo: z.enum(['CREDITO', 'SIN_CREDITO', 'GARANTIA']),
    porcentajeGarantia: z.coerce
      .number()
      .int('El porcentaje tiene que ser un número entero')
      .min(1, 'El porcentaje va de 1 a 100')
      .max(100, 'El porcentaje va de 1 a 100')
      .default(10),
  });

// Vacíos permitidos: el admin puede no tener todavía algún dato
const vacio = z.literal('');
const transferenciaSchema = z.object({
  alias: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9.-]{6,20}$/, 'El alias tiene entre 6 y 20 letras, números, puntos o guiones')
    .or(vacio),
  cbu: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{22}$/, 'El CBU/CVU tiene 22 números').or(vacio)),
  holder: texto(LARGOS.titular, 'El titular'),
  cuit: cuit.or(vacio),
  account: texto(LARGOS.textoCorto, 'La cuenta'),
});

// GET /api/config — lo público de la configuración (lo usa la sala y /creditos)
export const publicConfig = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ creditos: await settingsService.getCreditConfig() });
});

// GET /api/admin/configuracion
export const adminConfig = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    creditos: await settingsService.getCreditConfig(),
    transferencia: await settingsService.getTransferInfo(),
  });
});

export const setCreditos = asyncHandler(async (req: Request, res: Response) => {
  const config = creditosSchema.parse(req.body);
  res.json({ creditos: await settingsService.setCreditConfig(config) });
});

export const setTransferencia = asyncHandler(async (req: Request, res: Response) => {
  const datos = transferenciaSchema.parse(req.body);
  res.json({ transferencia: await settingsService.setTransferInfo(datos) });
});

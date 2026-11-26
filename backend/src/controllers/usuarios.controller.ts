import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { Errors } from '../utils/AppError';
import * as usuariosService from '../services/usuarios.service';
import * as favoritosService from '../services/favoritos.service';
import { codigoArea, codigoPostal, dniOCuil, LARGOS, nombrePersona, numeroCelular, texto } from '../schemas/comunes';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idParam = (req: Request, name = 'id') => {
  if (!UUID_RE.test(req.params[name])) throw Errors.notFound(name === 'id' ? 'Usuario' : 'Lote');
  return req.params[name];
};

// ---------- Base de personas (martillero/admin) ----------

const listaSchema = z.object({
  q: z.string().trim().max(100).optional(),
  rol: z.enum(['USER', 'MARTILLERO', 'ADMIN']).optional(),
  datos: z.enum(['completos', 'incompletos']).optional(),
  compradores: z.literal('1').optional(),
  bajas: z.literal('1').optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const f = listaSchema.parse(req.query);
  res.json(
    await usuariosService.listUsers({ ...f, compradores: f.compradores === '1', bajas: f.bajas === '1' })
  );
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usuariosService.getUserDetail(idParam(req)));
});

// '' → null para los opcionales
const opcional = <T extends z.ZodTypeAny>(s: T) =>
  s.or(z.literal('').transform(() => null)).nullable().optional();

const cambiosSchema = z
  .object({
    firstName: nombrePersona('nombre').optional(),
    lastName: nombrePersona('apellido').optional(),
    dni: opcional(dniOCuil),
    phoneAreaCode: opcional(codigoArea),
    phone: opcional(numeroCelular),
    phoneVerified: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    birthDate: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')),
    address: opcional(texto(LARGOS.direccion, 'La dirección')),
    city: opcional(texto(LARGOS.ciudad, 'La ciudad')),
    province: opcional(texto(LARGOS.provincia, 'La provincia')),
    zipCode: opcional(codigoPostal),
    role: z.enum(['USER', 'MARTILLERO', 'ADMIN']).optional(),
  })
  .refine(
    (d) => !d.phone || !d.phoneAreaCode || d.phoneAreaCode.length + d.phone.length === 10,
    { message: 'El código de área y el número tienen que sumar 10 números', path: ['phone'] }
  );

export const update = asyncHandler(async (req: Request, res: Response) => {
  const cambios = cambiosSchema.parse(req.body);
  res.json(await usuariosService.updateUser(idParam(req), cambios, req.user!));
});

// ---------- Favoritos del usuario ----------

export const favoritos = asyncHandler(async (req: Request, res: Response) => {
  res.json({ lots: await favoritosService.listFavorites(req.user!.userId) });
});

export const favoritosIds = asyncHandler(async (req: Request, res: Response) => {
  res.json({ lotIds: await favoritosService.favoriteIds(req.user!.userId) });
});

export const agregarFavorito = asyncHandler(async (req: Request, res: Response) => {
  await favoritosService.addFavorite(req.user!.userId, idParam(req, 'lotId'));
  res.status(201).json({ ok: true });
});

export const quitarFavorito = asyncHandler(async (req: Request, res: Response) => {
  await favoritosService.removeFavorite(req.user!.userId, idParam(req, 'lotId'));
  res.json({ ok: true });
});

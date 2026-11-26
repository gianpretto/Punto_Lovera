import { z } from 'zod';
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as auctionService from '../services/auction.service';
import { createAuctionSchema, createPassSchema, setCurrentLotSchema, updateAuctionSchema } from '../schemas/auction.schema';
import * as passService from '../services/pass.service';
import { Errors } from '../utils/AppError';
import { assertVisible, esStaff, lotePublico } from '../services/visibilidad';
import { broadcastRoomState, setCurrentLotAndBroadcast } from '../services/realtime.service';
import { auctions } from '../db/schema';
import { removeUploadedFile, toPublicUrl } from '../middleware/upload.middleware';

type AuctionStatus = (typeof auctions.$inferSelect)['status'];

const ESTADOS = ['PROXIMA', 'ACTIVA', 'FINALIZADA', 'CANCELADA'] as const;

// La clave de transmisión (cameraId) no se publica (la saca el json
// replacer de app.ts); se agrega solo si está habilitada
const conCamara = <T extends { cameraId: string | null }>(a: T) => ({ ...a, cameraOn: Boolean(a.cameraId) });

// ?status=ACTIVA,PROXIMA (uno o varios) &page=1 &pageSize=6 (máx. 24).
// Sin page devuelve la lista completa (la usa el admin).
const listQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim().toUpperCase()) : undefined))
    .pipe(z.array(z.enum(ESTADOS)).max(4).optional()),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  pageSize: z.coerce.number().int().min(1).max(24).default(6),
  // ?ocultas=1: el admin ve también las no publicadas
  ocultas: z.literal('1').optional(),
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, pageSize, ocultas } = listQuerySchema.parse(req.query);
  const incluirOcultas = ocultas === '1' && esStaff(req.user);
  if (page === undefined) {
    const auctions = await auctionService.listAuctions(status as AuctionStatus[] | undefined, incluirOcultas);
    return res.json({ auctions: auctions.map(conCamara) });
  }
  const pagina = await auctionService.listAuctionsPage(
    status as AuctionStatus[] | undefined,
    page,
    pageSize,
    incluirOcultas
  );
  res.json({ ...pagina, auctions: pagina.auctions.map(conCamara) });
});

// ?lots=false: sin los lotes (el catálogo los pide paginados en /:id/lotes)
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const staff = esStaff(req.user);
  if (req.query.lots === 'false') {
    const auction = await auctionService.getAuctionSummary(req.params.id);
    assertVisible(auction, staff);
    return res.json({ auction: conCamara(auction) });
  }
  const auction = await auctionService.getAuctionById(req.params.id);
  assertVisible(auction, staff);
  res.json({ auction: conCamara({ ...auction, lots: auction.lots.map((l) => lotePublico(l, staff)) }) });
});

const lotsPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(6),
});

// GET /subastas/:id/lotes?page=1&pageSize=6 (catálogo paginado)
export const listLots = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize } = lotsPageSchema.parse(req.query);
  const staff = esStaff(req.user);
  const pagina = await auctionService.listLotsPage(req.params.id, page, pageSize, staff);
  res.json({ ...pagina, lots: pagina.lots.map((l) => lotePublico(l, staff)) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createAuctionSchema.parse(req.body);
  const auction = await auctionService.createAuction(req.user!.userId, data);
  res.status(201).json({ auction });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateAuctionSchema.parse(req.body);
  const auction = await auctionService.updateAuction(req.params.id, data);
  // La sala abierta se entera del cambio de estado/título (best-effort)
  broadcastRoomState(req.params.id).catch(() => undefined);
  res.json({ auction });
});

// Sube la foto de portada (multipart, campo "image") y la deja como coverImageUrl
export const uploadCover = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw Errors.badRequest('Elegí una imagen para la portada');
  const url = toPublicUrl('lots', req.file.filename);
  try {
    const auction = await auctionService.setAuctionCover(req.params.id, url);
    res.status(201).json({ auction });
  } catch (err) {
    await removeUploadedFile(url);
    throw err;
  }
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await auctionService.deleteAuction(req.params.id);
  res.status(204).send();
});

// El martillero elige qué lote se remata ahora en la sala en vivo
// (lotId: null = volver al primer lote sin vender).
export const setCurrentLot = asyncHandler(async (req: Request, res: Response) => {
  const { lotId } = setCurrentLotSchema.parse(req.body);
  const state = await setCurrentLotAndBroadcast(req.params.id, lotId);
  res.json(state);
});

// ---------- Pases de invitado ----------

export const createPass = asyncHandler(async (req: Request, res: Response) => {
  const { label, hours } = createPassSchema.parse(req.body);
  const pass = await passService.createPass(req.params.id, req.user!.userId, label, hours);
  res.status(201).json({ pass });
});

export const listPasses = asyncHandler(async (req: Request, res: Response) => {
  res.json({ passes: await passService.listPasses(req.params.id) });
});

export const revokePass = asyncHandler(async (req: Request, res: Response) => {
  await passService.revokePass(req.params.id, req.params.passId);
  res.status(204).send();
});

// Público: el front valida el pase del link antes de mostrar la sala
export const checkPass = asyncHandler(async (req: Request, res: Response) => {
  const pass = await passService.validatePass(req.params.token, req.params.id);
  if (!pass) throw Errors.notFound('Pase vigente');
  res.json({ pass: { label: pass.label, expiresAt: pass.expiresAt } });
});

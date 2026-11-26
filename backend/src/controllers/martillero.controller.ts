import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { Errors } from '../utils/AppError';
import { liveLotSchema, sanctionSchema } from '../schemas/auction.schema';
import * as martilleroService from '../services/martillero.service';
import {
  broadcastBidVoided,
  broadcastRoomState,
  getPrivateMessages,
  sendChatMessage,
  notifySanction,
  setCurrentLotAndBroadcast,
} from '../services/realtime.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id mal formado haría fallar a Postgres con un 500: respondemos 404
function uuidParam(req: Request, name: string, what: string) {
  const v = req.params[name];
  if (!UUID_RE.test(v)) throw Errors.notFound(what);
  return v;
}

// PATCH /subastas/:id/lotes/:lotId/vivo — corregir precio, ganador, incremento o mínima
export const updateLiveLot = asyncHandler(async (req: Request, res: Response) => {
  const auctionId = uuidParam(req, 'id', 'Subasta');
  const lotId = uuidParam(req, 'lotId', 'Lote');
  const changes = liveLotSchema.parse(req.body);
  await martilleroService.updateLiveLot(auctionId, lotId, changes);
  res.json(await broadcastRoomState(auctionId));
});

// POST /subastas/:id/pujas/:bidId/anular
export const voidBid = asyncHandler(async (req: Request, res: Response) => {
  const auctionId = uuidParam(req, 'id', 'Subasta');
  const bidId = uuidParam(req, 'bidId', 'Oferta');
  const { lotId } = await martilleroService.voidBid(auctionId, bidId, req.user!.userId);
  res.json(await broadcastBidVoided(auctionId, bidId, lotId));
});

// POST /subastas/:id/siguiente-lote y /lote-anterior
const moverLote = (direccion: 1 | -1) =>
  asyncHandler(async (req: Request, res: Response) => {
    const auctionId = uuidParam(req, 'id', 'Subasta');
    const lotId = await martilleroService.adjacentLotId(auctionId, direccion);
    res.json(await setCurrentLotAndBroadcast(auctionId, lotId));
  });
export const nextLot = moverLote(1);
export const previousLot = moverLote(-1);

export const listSanctions = asyncHandler(async (req: Request, res: Response) => {
  const auctionId = uuidParam(req, 'id', 'Subasta');
  res.json({ sanctions: await martilleroService.listSanctions(auctionId) });
});

export const addSanction = asyncHandler(async (req: Request, res: Response) => {
  const auctionId = uuidParam(req, 'id', 'Subasta');
  const { userId, type } = sanctionSchema.parse(req.body);
  const sanction = await martilleroService.addSanction(auctionId, userId, type, req.user!.userId);
  await notifySanction(auctionId, userId, type, true);
  res.status(201).json({ sanction });
});

export const removeSanction = asyncHandler(async (req: Request, res: Response) => {
  const auctionId = uuidParam(req, 'id', 'Subasta');
  const sanctionId = uuidParam(req, 'sanctionId', 'Sanción');
  const removed = await martilleroService.removeSanction(auctionId, sanctionId);
  await notifySanction(auctionId, removed.userId, removed.type, false);
  res.json({ sanction: removed });
});

// ---------- Mensajes privados de los usuarios al martillero ----------

const privadoSchema = z.object({
  userId: z.string().uuid(),
  text: z.string().trim().min(1, 'Escribí un mensaje').max(500, 'El mensaje es demasiado largo'),
});

// GET /subastas/:id/privados — todas las conversaciones privadas de la subasta
export const listPrivate = asyncHandler(async (req: Request, res: Response) => {
  const auctionId = uuidParam(req, 'id', 'Subasta');
  res.json({ messages: await getPrivateMessages(auctionId) });
});

// POST /subastas/:id/privados { userId, text } — el martillero contesta en privado
export const replyPrivate = asyncHandler(async (req: Request, res: Response) => {
  const auctionId = uuidParam(req, 'id', 'Subasta');
  const { userId, text } = privadoSchema.parse(req.body);
  const message = await sendChatMessage(auctionId, req.user!.userId, text, { paraUserId: userId });
  res.status(201).json({ message });
});

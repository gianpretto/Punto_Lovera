import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as lotService from '../services/lot.service';
import * as bidService from '../services/bid.service';
import { placeBidAndBroadcast } from '../services/realtime.service';
import { createLotSchema, placeBidSchema, updateLotSchema } from '../schemas/auction.schema';
import { toPublicUrl } from '../middleware/upload.middleware';

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const lot = await lotService.getLotById(req.params.lotId);
  res.json({ lot });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createLotSchema.parse(req.body);
  const lot = await lotService.createLot(req.params.auctionId, data);
  res.status(201).json({ lot });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateLotSchema.parse(req.body);
  const lot = await lotService.updateLot(req.params.lotId, data);
  res.json({ lot });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await lotService.deleteLot(req.params.lotId);
  res.status(204).send();
});

export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const urls = files.map((f) => toPublicUrl('lots', f.filename));
  const lot = await lotService.addLotImages(req.params.lotId, urls);
  res.status(201).json({ lot });
});

export const bids = asyncHandler(async (req: Request, res: Response) => {
  const bids = await bidService.listBidsForLot(req.params.lotId);
  res.json({ bids });
});

// La puja también se puede hacer por HTTP (además del WebSocket) para
// tener un fallback simple y para tests; ambos caminos usan el mismo
// placeBidAndBroadcast así que quedan siempre consistentes (misma
// validación, mismo mensaje de chat, mismo evento emitido).
export const placeBid = asyncHandler(async (req: Request, res: Response) => {
  const { amount } = placeBidSchema.parse(req.body);
  const result = await placeBidAndBroadcast(req.params.lotId, req.user!.userId, amount);
  res.status(201).json({ bid: result.bid, lot: result.lot });
});

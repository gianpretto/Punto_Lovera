import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as lotService from '../services/lot.service';
import * as bidService from '../services/bid.service';
import { broadcastRoomState, placeBidAndBroadcast } from '../services/realtime.service';
import { createLotSchema, placeBidSchema, updateLotSchema } from '../schemas/auction.schema';
import { removeUploadedFile, toPublicUrl } from '../middleware/upload.middleware';

// Si la sala está abierta, que vea el cambio (precio base, título, fotos)
// sin recargar. Es best-effort: un error acá no debe romper la edición.
function refreshRoom(auctionId: string) {
  broadcastRoomState(auctionId).catch(() => undefined);
}

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const lot = await lotService.getLotById(req.params.lotId, req.params.auctionId);
  res.json({ lot });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createLotSchema.parse(req.body);
  const lot = await lotService.createLot(req.params.auctionId, data);
  refreshRoom(req.params.auctionId);
  res.status(201).json({ lot });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateLotSchema.parse(req.body);
  const lot = await lotService.updateLot(req.params.auctionId, req.params.lotId, data);
  refreshRoom(req.params.auctionId);
  res.json({ lot });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await lotService.deleteLot(req.params.auctionId, req.params.lotId);
  refreshRoom(req.params.auctionId);
  res.status(204).send();
});

export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const urls = files.map((f) => toPublicUrl('lots', f.filename));
  try {
    const lot = await lotService.addLotImages(req.params.auctionId, req.params.lotId, urls);
    refreshRoom(req.params.auctionId);
    res.status(201).json({ lot });
  } catch (err) {
    // Multer ya guardó los archivos: si el lote no existe, no los dejamos huérfanos
    await Promise.all(urls.map((url) => removeUploadedFile(url)));
    throw err;
  }
});

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  const { auctionId, lotId, imageId } = req.params;
  const lot = await lotService.deleteLotImage(auctionId, lotId, imageId);
  refreshRoom(auctionId);
  res.json({ lot });
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

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as auctionService from '../services/auction.service';
import { createAuctionSchema, setCurrentLotSchema, updateAuctionSchema } from '../schemas/auction.schema';
import { setCurrentLotAndBroadcast } from '../services/realtime.service';
import { auctions } from '../db/schema';

type AuctionStatus = (typeof auctions.$inferSelect)['status'];

export const list = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as AuctionStatus | undefined;
  const auctions = await auctionService.listAuctions(status);
  res.json({ auctions });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const auction = await auctionService.getAuctionById(req.params.id);
  res.json({ auction });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = createAuctionSchema.parse(req.body);
  const auction = await auctionService.createAuction(req.user!.userId, data);
  res.status(201).json({ auction });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = updateAuctionSchema.parse(req.body);
  const auction = await auctionService.updateAuction(req.params.id, data);
  res.json({ auction });
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

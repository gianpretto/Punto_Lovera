import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as purchaseService from '../services/purchase.service';

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const purchases = await purchaseService.listMyPurchases(req.user!.userId);
  res.json({ purchases });
});

export const closeLot = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await purchaseService.closeLotAndCreatePurchase(req.params.lotId);
  res.status(201).json({ purchase });
});

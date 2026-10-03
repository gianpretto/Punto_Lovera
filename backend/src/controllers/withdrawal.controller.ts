import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as withdrawalService from '../services/withdrawal.service';
import { rejectWithdrawalSchema, requestWithdrawalSchema } from '../schemas/voucher.schema';
import { Errors } from '../utils/AppError';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id mal formado haría fallar a Postgres con un 500: respondemos 404
function withdrawalId(req: Request) {
  if (!UUID_RE.test(req.params.id)) throw Errors.notFound('Reintegro');
  return req.params.id;
}

export const request = asyncHandler(async (req: Request, res: Response) => {
  const data = requestWithdrawalSchema.parse(req.body);
  const withdrawal = await withdrawalService.requestWithdrawal(req.user!.userId, data);
  res.status(201).json({ withdrawal, message: 'Pedido de reintegro recibido, te avisamos por mail cuando se procese' });
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const withdrawals = await withdrawalService.listMyWithdrawals(req.user!.userId);
  res.json({ withdrawals });
});

export const pending = asyncHandler(async (_req: Request, res: Response) => {
  const withdrawals = await withdrawalService.listPendingWithdrawals();
  res.json({ withdrawals });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const withdrawal = await withdrawalService.approveWithdrawal(withdrawalId(req), req.user!.userId);
  res.json({ withdrawal });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const id = withdrawalId(req);
  const { reason } = rejectWithdrawalSchema.parse(req.body);
  const withdrawal = await withdrawalService.rejectWithdrawal(id, req.user!.userId, reason);
  res.json({ withdrawal });
});

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as voucherService from '../services/voucher.service';
import { rejectVoucherSchema, submitVoucherSchema } from '../schemas/voucher.schema';
import path from 'path';
import { toPublicUrl, UPLOAD_ROOT } from '../middleware/upload.middleware';
import { Errors } from '../utils/AppError';
import { env } from '../config/env';

export const transferInfo = asyncHandler(async (_req: Request, res: Response) => {
  // Datos de transferencia que se muestran en /creditos — no hay pasarela
  // de pago integrada, el usuario transfiere y sube el comprobante.
  res.json({ transfer: env.transfer });
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const { amount } = submitVoucherSchema.parse(req.body);
  const file = req.file;
  if (!file) throw Errors.badRequest('Falta subir el comprobante');

  const fileUrl = toPublicUrl('vouchers', file.filename);
  const voucher = await voucherService.submitVoucher(req.user!.userId, amount, fileUrl);
  res.status(201).json({ voucher, message: 'Comprobante recibido, un admin lo va a revisar pronto' });
});

export const file = asyncHandler(async (req: Request, res: Response) => {
  const voucher = await voucherService.getVoucherForViewer(req.params.id, req.user!);
  // fileUrl es "/uploads/vouchers/<archivo>": usamos solo el nombre para no
  // poder salir de la carpeta de comprobantes
  const filePath = path.join(UPLOAD_ROOT, 'vouchers', path.basename(voucher.fileUrl));
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Archivo del comprobante no encontrado' });
  });
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const vouchers = await voucherService.listMyVouchers(req.user!.userId);
  res.json({ vouchers });
});

export const pending = asyncHandler(async (_req: Request, res: Response) => {
  const vouchers = await voucherService.listPendingVouchers();
  res.json({ vouchers });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const voucher = await voucherService.approveVoucher(req.params.id, req.user!.userId);
  res.json({ voucher });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = rejectVoucherSchema.parse(req.body);
  const voucher = await voucherService.rejectVoucher(req.params.id, req.user!.userId, reason);
  res.json({ voucher });
});

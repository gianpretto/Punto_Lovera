import { Router } from 'express';
import * as purchaseController from '../controllers/purchase.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/mias', requireAuth, purchaseController.mine);
router.post(
  '/cerrar-lote/:lotId',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  purchaseController.closeLot
);

export default router;

import { Router } from 'express';
import * as auctionController from '../controllers/auction.controller';
import * as lotController from '../controllers/lot.controller';
import * as liveController from '../controllers/live.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { uploadLotImages } from '../middleware/upload.middleware';

const router = Router();

// Públicas
router.get('/', auctionController.list);
router.get('/:id', auctionController.getOne);
router.get('/:auctionId/lotes/:lotId', lotController.getOne);
router.get('/:auctionId/lotes/:lotId/pujas', lotController.bids);

// Solo usuarios autenticados
router.post('/:auctionId/lotes/:lotId/pujas', requireAuth, lotController.placeBid);

// Video en vivo: cualquier usuario logueado puede MIRAR (el proxy exige
// JWT porque el media server de rtsp-manager no tiene auth propia).
// Prender/apagar la cámara es solo martillero/admin.
router.get('/:id/vivo/:protocol/*', requireAuth, liveController.proxyStream);
router.post('/:id/camara', requireAuth, requireRole('MARTILLERO', 'ADMIN'), liveController.startCamera);
router.delete('/:id/camara', requireAuth, requireRole('MARTILLERO', 'ADMIN'), liveController.stopCamera);

// Solo martillero/admin
router.post('/', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.create);
router.patch('/:id', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.update);
router.delete('/:id', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.remove);

router.post(
  '/:auctionId/lotes',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  lotController.create
);
router.patch(
  '/:auctionId/lotes/:lotId',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  lotController.update
);
router.delete(
  '/:auctionId/lotes/:lotId',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  lotController.remove
);
router.post(
  '/:auctionId/lotes/:lotId/imagenes',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  uploadLotImages.array('images', 10),
  lotController.uploadImages
);

export default router;

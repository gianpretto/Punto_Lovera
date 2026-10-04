import { Router } from 'express';
import * as auctionController from '../controllers/auction.controller';
import * as lotController from '../controllers/lot.controller';
import * as liveController from '../controllers/live.controller';
import { requireAuth, requireAuthOrPass, requireRole } from '../middleware/auth.middleware';
import { handleUpload, uploadAuctionCover, uploadLotImages } from '../middleware/upload.middleware';

const router = Router();

// Públicas
router.get('/', auctionController.list);
router.get('/:id', auctionController.getOne);
router.get('/:auctionId/lotes/:lotId', lotController.getOne);
// Lista de pujas con nombre y apellido de cada postor: solo el panel del martillero
router.get('/:auctionId/lotes/:lotId/pujas', requireAuth, requireRole('MARTILLERO', 'ADMIN'), lotController.bids);

// Solo usuarios autenticados
router.post('/:auctionId/lotes/:lotId/pujas', requireAuth, lotController.placeBid);

// Video en vivo: cualquier usuario logueado puede MIRAR (el proxy exige
// JWT porque el media server de rtsp-manager no tiene auth propia).
// Prender/apagar la cámara es solo martillero/admin.
router.get('/:id/vivo/:protocol/*', requireAuthOrPass('id'), liveController.proxyStream);

// Pases de invitado (link temporal para mirar sin cuenta)
router.get('/:id/pases/:token/validar', auctionController.checkPass);
router.get('/:id/pases', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.listPasses);
router.post('/:id/pases', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.createPass);
router.delete('/:id/pases/:passId', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.revokePass);
router.get('/:id/camara', requireAuth, requireRole('MARTILLERO', 'ADMIN'), liveController.streamInfo);
router.post('/:id/camara', requireAuth, requireRole('MARTILLERO', 'ADMIN'), liveController.startCamera);
router.delete('/:id/camara', requireAuth, requireRole('MARTILLERO', 'ADMIN'), liveController.stopCamera);

// Solo martillero/admin
router.post('/', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.create);
router.patch('/:id', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.update);
router.delete('/:id', requireAuth, requireRole('MARTILLERO', 'ADMIN'), auctionController.remove);
router.post(
  '/:id/portada',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  handleUpload(uploadAuctionCover.single('image')),
  auctionController.uploadCover
);
router.patch(
  '/:id/lote-actual',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  auctionController.setCurrentLot
);

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
  handleUpload(uploadLotImages.array('images', 10)),
  lotController.uploadImages
);
router.delete(
  '/:auctionId/lotes/:lotId/imagenes/:imageId',
  requireAuth,
  requireRole('MARTILLERO', 'ADMIN'),
  lotController.removeImage
);

export default router;

import { Router } from 'express';
import * as auctionController from '../controllers/auction.controller';
import * as lotController from '../controllers/lot.controller';
import * as liveController from '../controllers/live.controller';
import * as martilleroController from '../controllers/martillero.controller';
import { optionalAuth, requireAuth, requireAuthOrPass, requireRole } from '../middleware/auth.middleware';
import { handleUpload, uploadAuctionCover, uploadLotImages } from '../middleware/upload.middleware';

const router = Router();

// Públicas
// optionalAuth: el martillero/admin ve también las subastas ocultas y el precio base
router.get('/', optionalAuth, auctionController.list);
router.get('/:id', optionalAuth, auctionController.getOne);
router.get('/:id/lotes', optionalAuth, auctionController.listLots);
router.get('/:auctionId/lotes/:lotId', optionalAuth, lotController.getOne);
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
// Controles en vivo del martillero y moderación de la sala
const staff = [requireAuth, requireRole('MARTILLERO', 'ADMIN')];
router.patch('/:id/lotes/:lotId/vivo', ...staff, martilleroController.updateLiveLot);
router.post('/:id/pujas/:bidId/anular', ...staff, martilleroController.voidBid);
router.post('/:id/siguiente-lote', ...staff, martilleroController.nextLot);
router.post('/:id/lote-anterior', ...staff, martilleroController.previousLot);
router.get('/:id/privados', ...staff, martilleroController.listPrivate);
router.post('/:id/privados', ...staff, martilleroController.replyPrivate);
router.get('/:id/sanciones', ...staff, martilleroController.listSanctions);
router.post('/:id/sanciones', ...staff, martilleroController.addSanction);
router.delete('/:id/sanciones/:sanctionId', ...staff, martilleroController.removeSanction);

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

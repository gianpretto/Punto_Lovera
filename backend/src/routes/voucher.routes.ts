import { Router } from 'express';
import * as voucherController from '../controllers/voucher.controller';
import * as withdrawalController from '../controllers/withdrawal.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { uploadVoucher } from '../middleware/upload.middleware';

const router = Router();

router.get('/transferencia', voucherController.transferInfo);

// Reintegros (devolver crédito no usado). Van antes que las rutas /:id/...
// de comprobantes para que "reintegros" no se tome como un id.
router.post('/reintegros', requireAuth, withdrawalController.request);
router.get('/reintegros/mios', requireAuth, withdrawalController.mine);
router.get('/reintegros/pendientes', requireAuth, requireRole('ADMIN'), withdrawalController.pending);
router.post('/reintegros/:id/aprobar', requireAuth, requireRole('ADMIN'), withdrawalController.approve);
router.post('/reintegros/:id/rechazar', requireAuth, requireRole('ADMIN'), withdrawalController.reject);

router.post('/', requireAuth, uploadVoucher.single('comprobante'), voucherController.submit);
router.get('/mios', requireAuth, voucherController.mine);
router.get('/:id/archivo', requireAuth, voucherController.file);

router.get('/pendientes', requireAuth, requireRole('ADMIN'), voucherController.pending);
router.post('/:id/aprobar', requireAuth, requireRole('ADMIN'), voucherController.approve);
router.post('/:id/rechazar', requireAuth, requireRole('ADMIN'), voucherController.reject);

export default router;

import { Router } from 'express';
import * as voucherController from '../controllers/voucher.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { uploadVoucher } from '../middleware/upload.middleware';

const router = Router();

router.get('/transferencia', voucherController.transferInfo);

router.post('/', requireAuth, uploadVoucher.single('comprobante'), voucherController.submit);
router.get('/mios', requireAuth, voucherController.mine);

router.get('/pendientes', requireAuth, requireRole('ADMIN'), voucherController.pending);
router.post('/:id/aprobar', requireAuth, requireRole('ADMIN'), voucherController.approve);
router.post('/:id/rechazar', requireAuth, requireRole('ADMIN'), voucherController.reject);

export default router;

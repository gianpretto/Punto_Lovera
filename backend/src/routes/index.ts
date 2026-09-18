import { Router } from 'express';
import authRoutes from './auth.routes';
import auctionRoutes from './auction.routes';
import voucherRoutes from './voucher.routes';
import purchaseRoutes from './purchase.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/subastas', auctionRoutes);
router.use('/creditos', voucherRoutes);
router.use('/compras', purchaseRoutes);

router.get('/health', (_req, res) => res.json({ ok: true }));

export default router;

import { Router } from 'express';
import * as contactController from '../controllers/contact.controller';
import { contactLimiter } from '../middleware/rateLimit.middleware';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.post('/', contactLimiter, contactController.create);
// Consultas recibidas: solo el admin (se guardan aunque el mail de aviso falle)
router.get('/', requireAuth, requireRole('ADMIN'), contactController.list);

export default router;

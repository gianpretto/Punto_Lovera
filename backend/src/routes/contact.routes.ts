import { Router } from 'express';
import * as contactController from '../controllers/contact.controller';
import { contactLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/', contactLimiter, contactController.create);

export default router;

import { Router } from 'express';
import * as configController from '../controllers/config.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

// /api/config (público) y /api/admin/configuracion (solo ADMIN)
export const publicConfigRoutes = Router();
publicConfigRoutes.get('/', configController.publicConfig);

export const adminConfigRoutes = Router();
adminConfigRoutes.use(requireAuth, requireRole('ADMIN'));
adminConfigRoutes.get('/', configController.adminConfig);
adminConfigRoutes.put('/creditos', configController.setCreditos);
adminConfigRoutes.put('/transferencia', configController.setTransferencia);

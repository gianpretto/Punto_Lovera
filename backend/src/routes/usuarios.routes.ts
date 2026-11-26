import { Router } from 'express';
import * as usuariosController from '../controllers/usuarios.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

// /api/admin/usuarios: base de personas (martillero y admin)
export const adminUsuariosRoutes = Router();
adminUsuariosRoutes.use(requireAuth, requireRole('MARTILLERO', 'ADMIN'));
adminUsuariosRoutes.get('/', usuariosController.list);
adminUsuariosRoutes.get('/:id', usuariosController.detail);
adminUsuariosRoutes.patch('/:id', usuariosController.update);

// /api/favoritos: lotes favoritos del usuario logueado
export const favoritosRoutes = Router();
favoritosRoutes.use(requireAuth);
favoritosRoutes.get('/', usuariosController.favoritos);
favoritosRoutes.get('/ids', usuariosController.favoritosIds);
favoritosRoutes.post('/:lotId', usuariosController.agregarFavorito);
favoritosRoutes.delete('/:lotId', usuariosController.quitarFavorito);

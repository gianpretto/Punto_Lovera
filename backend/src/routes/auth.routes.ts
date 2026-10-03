import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import {
  forgotPasswordLimiter,
  loginIpLimiter,
  loginLimiter,
  registerLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from '../middleware/rateLimit.middleware';

const router = Router();

// Límites de intentos estrictos: valores y motivos en rateLimit.middleware.ts
router.post('/register', registerLimiter, authController.register);
router.post('/login', loginIpLimiter, loginLimiter, authController.login);
router.post('/verify-email', verifyEmailLimiter, authController.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, authController.resendVerification);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);
router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, authController.updateMe);

export default router;

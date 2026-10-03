import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../schemas/auth.schema';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const user = await authService.register(input);
  res.status(201).json({ user, message: 'Cuenta creada. Revisá tu mail para confirmarla.' });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.json(result);
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = verifyEmailSchema.parse(req.body);
  const session = await authService.verifyEmail(token);
  res.json({ message: 'Cuenta verificada correctamente', ...session });
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = resendVerificationSchema.parse(req.body);
  await authService.resendVerification(email);
  res.json({ message: 'Si la cuenta existe y no está verificada, te reenviamos el mail' });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await authService.requestPasswordReset(email);
  res.json({ message: 'Si el email existe, te enviamos instrucciones para recuperar tu contraseña' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(token, password);
  res.json({ message: 'Contraseña actualizada correctamente' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.userId);
  res.json({ user });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await authService.updateProfile(req.user!.userId, input);
  res.json({ user });
});

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/auth.service';
import { verifyGoogleCredential } from '../services/google.service';
import { env } from '../config/env';
import {
  forgotPasswordSchema,
  googleLoginSchema,
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
  res.status(201).json({
    user,
    message: user.emailVerified ? 'Cuenta creada.' : 'Cuenta creada. Revisá tu mail para confirmarla.',
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.json(result);
});

export const google = asyncHandler(async (req: Request, res: Response) => {
  const { credential } = googleLoginSchema.parse(req.body);
  const profile = await verifyGoogleCredential(credential);
  const result = await authService.loginWithGoogle(profile);
  res.status(result.isNew ? 201 : 200).json(result);
});

// El front pregunta si mostrar el botón de Google y con qué Client ID (es
// público: va en el HTML de cualquier sitio con "Continuar con Google")
export const googleConfig = (_req: Request, res: Response) => {
  res.json({ clientId: env.googleClientId || null });
};

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

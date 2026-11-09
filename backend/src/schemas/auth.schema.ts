import { z } from 'zod';
import { LARGOS, codigoArea, codigoPostal, dniOCuil, nombrePersona, numeroCelular, texto } from './comunes';

// Los mails se guardan y comparan siempre en minúsculas y sin espacios: así
// "Juan@mail.com" y "juan@mail.com" son la misma cuenta (no se puede
// registrar dos veces el mismo mail).
const email = (msg?: string) => z.string().trim().toLowerCase().max(LARGOS.email, 'Email demasiado largo').email(msg);

// bcrypt solo usa los primeros 72 bytes: más largo daría una falsa seguridad
const newPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'La contraseña puede tener como máximo 72 caracteres');

export const registerSchema = z.object({
  email: email('Email inválido'),
  password: newPassword,
  firstName: nombrePersona('nombre'),
  lastName: nombrePersona('apellido'),
});

export const loginSchema = z.object({
  email: email(),
  password: z.string().min(1).max(200),
  /** "Recordarme": sesión de 30 días en lugar de 12 horas */
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: newPassword,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(200),
});

export const resendVerificationSchema = z.object({
  email: email(),
});

/** Fecha real (no 31/02), desde 1900 y no en el futuro */
function fechaDeNacimientoValida(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  const real = fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
  return real && a >= 1900 && fecha.getTime() <= Date.now();
}

// Todos opcionales: el front manda solo lo que se editó en /datos.
// '' se acepta y se guarda como null (campo borrado), salvo nombre y
// apellido. El celular no va acá: se cambia con su código de verificación.
const opcional = <T extends z.ZodTypeAny>(schema: T) => schema.or(z.literal('')).optional();

export const updateProfileSchema = z.object({
  firstName: nombrePersona('nombre').optional(),
  lastName: nombrePersona('apellido').optional(),
  dni: opcional(dniOCuil),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
    .refine(fechaDeNacimientoValida, 'Fecha de nacimiento inválida')
    .or(z.literal(''))
    .optional(),
  address: opcional(texto(LARGOS.direccion, 'La dirección')),
  city: opcional(texto(LARGOS.ciudad, 'La ciudad')),
  province: opcional(texto(LARGOS.provincia, 'La provincia')),
  zipCode: opcional(codigoPostal),
});

// Celular: código de área (sin 0) + número (sin 15) = 10 dígitos
export const phoneSchema = z
  .object({ areaCode: codigoArea, phone: numeroCelular })
  .refine((d) => d.areaCode.length + d.phone.length === 10, {
    message: 'El código de área y el número tienen que sumar 10 números (ej. 11 + 12345678)',
    path: ['phone'],
  });

export const phoneCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 números'),
});

export const changePasswordSchema = z.object({
  // Las cuentas creadas con Google no tienen contraseña actual
  currentPassword: z.string().max(200).optional(),
  newPassword,
  remember: z.boolean().optional(),
});

// Dar de baja la cuenta: se confirma escribiendo la contraseña (si tiene)
export const deleteAccountSchema = z.object({
  password: z.string().max(200).optional(),
});

// ID token que devuelve el botón de Google (JWT, ~1-2 KB)
export const googleLoginSchema = z.object({
  credential: z.string().min(1).max(4096),
});

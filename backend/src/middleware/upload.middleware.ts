import fs from 'fs';
import path from 'path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { AppError, Errors } from '../utils/AppError';

// Tamaño máximo por archivo (lo usa también error.middleware.ts en el mensaje)
export const MAX_UPLOAD_MB = 8;

// NOTA: guardamos en disco local para arrancar rápido. Para producción
// (Railway/Render no tienen disco persistente confiable) conviene migrar
// esto a un bucket S3-compatible (Cloudinary, Supabase Storage, S3) — el
// resto del código solo depende de que `file.url` quede accesible por HTTP,
// así que el cambio queda contenido acá.

const UPLOAD_ROOT = env.uploadDir ? path.resolve(env.uploadDir) : path.join(__dirname, '..', '..', 'uploads');

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

function makeStorage(subfolder: string) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      // La extensión sale del mimetype ya validado, NO del nombre que manda
      // el cliente: si no, una "imagen" llamada x.html se serviría como HTML
      // desde /uploads (XSS en el dominio de la API).
      const ext = EXT_BY_MIME[file.mimetype] ?? '';
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });
}

const imageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) return cb(null, true);
  // AppError: el middleware de errores lo devuelve como 400 con este motivo
  cb(Errors.badRequest('Solo se permiten imágenes (png, jpg, webp, gif)'));
};

const voucherFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype) || file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(Errors.badRequest('El comprobante debe ser una imagen o un PDF'));
};

export const uploadVoucher = multer({
  storage: makeStorage('vouchers'),
  fileFilter: voucherFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

export const uploadLotImages = multer({
  storage: makeStorage('lots'),
  fileFilter: imageFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// La portada de una subasta usa el mismo storage que las fotos de lotes
// (carpeta pública /uploads/lots, ver app.ts): son imágenes públicas igual.
export const uploadAuctionCover = uploadLotImages;

/**
 * Envuelve un middleware de multer para que sus errores (archivo muy grande,
 * demasiados archivos, tipo no permitido) los responda error.middleware.ts
 * (400/413 con mensaje en español) y no caigan como 500.
 */
export function handleUpload(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (err?: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError || err instanceof AppError) return next(err);
      next(Errors.badRequest(err instanceof Error ? err.message : 'No se pudo subir el archivo'));
    });
  };
}

/**
 * Borra del disco una imagen subida a partir de su URL pública
 * (/uploads/lots/<archivo>). Si la URL es externa o el archivo ya no
 * existe, no hace nada: borrar la fila de la base es lo importante.
 */
export async function removeUploadedFile(publicUrl: string | null | undefined): Promise<void> {
  const match = publicUrl?.match(/^\/uploads\/lots\/([\w.-]+)$/);
  if (!match) return;
  const file = path.join(UPLOAD_ROOT, 'lots', path.basename(match[1]));
  await fs.promises.unlink(file).catch(() => undefined);
}

/** Convierte la ruta en disco que dejó multer en una URL pública servible. */
export function toPublicUrl(subfolder: string, filename: string): string {
  return `/uploads/${subfolder}/${filename}`;
}

export { UPLOAD_ROOT };

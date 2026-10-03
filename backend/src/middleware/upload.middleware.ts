import fs from 'fs';
import path from 'path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';

// NOTA: guardamos en disco local para arrancar rápido. Para producción
// (Railway/Render no tienen disco persistente confiable) conviene migrar
// esto a un bucket S3-compatible (Cloudinary, Supabase Storage, S3) — el
// resto del código solo depende de que `file.url` quede accesible por HTTP,
// así que el cambio queda contenido acá.

const UPLOAD_ROOT = env.uploadDir ? path.resolve(env.uploadDir) : path.join(__dirname, '..', '..', 'uploads');

function makeStorage(subfolder: string) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });
}

const imageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) return cb(null, true);
  cb(new Error('Solo se permiten imágenes (png, jpg, webp, gif)'));
};

const voucherFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype) || file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(new Error('El comprobante debe ser una imagen o un PDF'));
};

export const uploadVoucher = multer({
  storage: makeStorage('vouchers'),
  fileFilter: voucherFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

export const uploadLotImages = multer({
  storage: makeStorage('lots'),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

// La portada de una subasta usa el mismo storage que las fotos de lotes
// (carpeta pública /uploads/lots, ver app.ts): son imágenes públicas igual.
export const uploadAuctionCover = uploadLotImages;

/**
 * Envuelve un middleware de multer para que sus errores (archivo muy grande,
 * demasiados archivos, tipo no permitido) lleguen como 400 con un mensaje
 * en español, en vez de caer como 500 en el error handler.
 */
export function handleUpload(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (err?: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const mensajes: Partial<Record<multer.ErrorCode, string>> = {
          LIMIT_FILE_SIZE: 'La imagen supera el máximo de 8 MB',
          LIMIT_FILE_COUNT: 'Demasiados archivos en una sola subida',
          LIMIT_UNEXPECTED_FILE: 'Demasiados archivos o campo de archivo inválido',
        };
        return next(Errors.badRequest(mensajes[err.code] ?? 'No se pudo subir el archivo'));
      }
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

import fs from 'fs';
import path from 'path';
import multer from 'multer';

// NOTA: guardamos en disco local para arrancar rápido. Para producción
// (Railway/Render no tienen disco persistente confiable) conviene migrar
// esto a un bucket S3-compatible (Cloudinary, Supabase Storage, S3) — el
// resto del código solo depende de que `file.url` quede accesible por HTTP,
// así que el cambio queda contenido acá.

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

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

/** Convierte la ruta en disco que dejó multer en una URL pública servible. */
export function toPublicUrl(subfolder: string, filename: string): string {
  return `/uploads/${subfolder}/${filename}`;
}

export { UPLOAD_ROOT };

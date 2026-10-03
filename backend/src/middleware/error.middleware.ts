import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { MAX_UPLOAD_MB } from './upload.middleware';

// Errores de multer (subida de archivos) → mensaje para el usuario
const MULTER_MESSAGES: Partial<Record<MulterError['code'], string>> = {
  LIMIT_FILE_COUNT: 'Subiste demasiados archivos de una vez',
  LIMIT_UNEXPECTED_FILE: 'Archivo inesperado en el formulario',
  LIMIT_PART_COUNT: 'El formulario tiene demasiados campos',
  LIMIT_FIELD_COUNT: 'El formulario tiene demasiados campos',
  LIMIT_FIELD_KEY: 'Nombre de campo demasiado largo',
  LIMIT_FIELD_VALUE: 'Un campo del formulario es demasiado largo',
};

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `El archivo es demasiado grande (máximo ${MAX_UPLOAD_MB} MB)` });
    }
    return res.status(400).json({ error: MULTER_MESSAGES[err.code] ?? 'No se pudo procesar el archivo subido' });
  }

  // Errores de express.json (body-parser): JSON mal formado o demasiado
  // grande. Son culpa del cliente, no un 500.
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  }
  if (type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

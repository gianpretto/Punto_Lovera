import { Request, Response } from 'express';
import { Readable } from 'stream';
import { asyncHandler } from '../utils/asyncHandler';
import * as liveService from '../services/live.service';
import { startCameraSchema } from '../schemas/live.schema';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';

export const startCamera = asyncHandler(async (req: Request, res: Response) => {
  const { name, rtspUrl } = startCameraSchema.parse(req.body);
  const auction = await liveService.startCamera(req.params.id, name, rtspUrl);
  res.status(201).json({ auction });
});

export const stopCamera = asyncHandler(async (req: Request, res: Response) => {
  const auction = await liveService.stopCamera(req.params.id);
  res.json({ auction });
});

const ALLOWED_PROTOCOLS = new Set(['hls', 'dash']);

/**
 * Proxy autenticado hacia el media server (nginx-rtmp de rtsp-manager).
 * El repo de Francis sirve HLS/DASH sin ningún control de acceso, así que
 * este endpoint es lo único autorizado a exponerlo: exige el mismo JWT que
 * el resto de la API (ver requireAuth en la ruta) y recién ahí reenvía el
 * archivo pedido (playlist .m3u8/.mpd o segmentos .ts/.m4s).
 */
export const proxyStream = asyncHandler(async (req: Request, res: Response) => {
  const protocol = req.params.protocol;
  if (!ALLOWED_PROTOCOLS.has(protocol)) throw Errors.badRequest('Protocolo de streaming inválido');

  const paths = await liveService.getStreamPaths(req.params.id);
  const basePath = protocol === 'hls' ? paths.hls : paths.dash;
  const rest = req.params[0] ?? '';

  const upstreamUrl = `${env.rtsp.mediaUrl}${basePath}/${rest}`;

  let upstreamRes: Response_;
  try {
    upstreamRes = await fetch(upstreamUrl);
  } catch {
    throw Errors.badRequest('No se pudo contactar al servidor de video');
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    return res.status(upstreamRes.status || 502).end();
  }

  res.status(upstreamRes.status);
  const contentType = upstreamRes.headers.get('content-type');
  if (contentType) res.setHeader('Content-Type', contentType);
  // Los manifests HLS/DASH no se deben cachear (cambian cada pocos segundos
  // mientras la subasta está en vivo); los segmentos ya emitidos sí son inmutables.
  res.setHeader('Cache-Control', rest.endsWith('.m3u8') || rest.endsWith('.mpd') ? 'no-store' : 'public, max-age=31536000, immutable');

  Readable.fromWeb(upstreamRes.body as import('stream/web').ReadableStream).pipe(res);
});

// Alias de tipo para evitar choque de nombres con el `Response` de Express arriba.
type Response_ = globalThis.Response;

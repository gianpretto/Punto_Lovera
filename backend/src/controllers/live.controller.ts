import crypto from 'crypto';
import { Request, Response } from 'express';
import { Readable } from 'stream';
import { asyncHandler } from '../utils/asyncHandler';
import * as liveService from '../services/live.service';
import { startCameraSchema } from '../schemas/live.schema';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';
import { broadcastRoomState } from '../services/realtime.service';

export const startCamera = asyncHandler(async (req: Request, res: Response) => {
  let auction;
  if (env.video.mode === 'obs') {
    // OBS: "prender la cámara" = habilitar la clave de transmisión
    auction = await liveService.enableObsStream(req.params.id);
  } else {
    const { name, rtspUrl } = startCameraSchema.parse(req.body);
    auction = await liveService.startCamera(req.params.id, name, rtspUrl);
  }
  // La sala se entera del cameraId nuevo y el reproductor arranca solo
  await broadcastRoomState(req.params.id);
  res.status(201).json({ auction });
});

export const stopCamera = asyncHandler(async (req: Request, res: Response) => {
  const auction =
    env.video.mode === 'obs'
      ? await liveService.disableObsStream(req.params.id)
      : await liveService.stopCamera(req.params.id);
  await broadcastRoomState(req.params.id);
  res.json({ auction });
});

/** Panel del martillero: servidor y clave para OBS, y si está llegando señal. */
export const streamInfo = asyncHandler(async (req: Request, res: Response) => {
  res.json(await liveService.getStreamInfo(req.params.id));
});

/**
 * Callback on_publish de nginx-rtmp (media-server): llega como form
 * urlencoded con name=<clave>. 2xx = acepta la transmisión, 403 = la corta.
 * Protegido con RTMP_AUTH_SECRET (va en la URL configurada en nginx).
 */
export const rtmpPublish = asyncHandler(async (req: Request, res: Response) => {
  const secret = String(req.query.secret ?? '');
  const expected = env.video.rtmpAuthSecret;
  const okSecret =
    expected.length > 0 &&
    secret.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  if (!okSecret) return res.status(403).send('forbidden');

  const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
  const auctionId = await liveService.validatePublishKey(name);
  if (!auctionId) {
    console.warn('[video] transmisión rechazada: clave inválida o subasta cerrada');
    return res.status(403).send('invalid stream key');
  }
  console.log('[video] transmisión aceptada');
  // El remate arranca cuando arranca la transmisión (si es la hora)
  if (await liveService.autoOpenOnStream(auctionId)) {
    console.log('[video] subasta abierta automáticamente al empezar la transmisión');
    await broadcastRoomState(auctionId);
  }
  res.status(200).send('ok');
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

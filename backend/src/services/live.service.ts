import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions } from '../db/schema';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';
import { getAuctionById } from './auction.service';
import { randomToken } from '../utils/tokens';

interface RtspManagerResponse {
  success: boolean;
  message?: string;
  data?: { configuration: { cameraId: string } };
}

/**
 * Cliente del control-plane de rtsp-manager (repo de Francis). Esta API no
 * tiene auth propia, así que SOLO la llamamos server-to-server desde acá —
 * nunca debe quedar expuesta directamente a internet. Lo que sí exponemos
 * (protegido con JWT) es el proxy de media en live.controller.ts.
 */
async function callControlPlane(path: string, init?: RequestInit): Promise<RtspManagerResponse> {
  let res: Response;
  try {
    res = await fetch(`${env.rtsp.controlUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw Errors.badRequest('No se pudo contactar al servicio de cámaras (rtsp-manager). ¿Está corriendo?');
  }

  const body = (await res.json().catch(() => ({}))) as RtspManagerResponse;
  if (!res.ok || !body.success) {
    throw Errors.badRequest(body.message ?? 'El servicio de cámaras rechazó la operación');
  }
  return body;
}

// ---------- Modo OBS (por defecto) ----------
//
// La "cámara" de la subasta es una clave de transmisión: cameraId es un
// token al azar y OBS publica con la clave "camera_<cameraId>". El
// media-server pregunta al backend (validatePublishKey) antes de aceptar.

const STREAM_PREFIX = 'camera_';

export function streamKeyFor(cameraId: string) {
  return `${STREAM_PREFIX}${cameraId}`;
}

/** Genera (o reusa) la clave de transmisión de la subasta. */
export async function enableObsStream(auctionId: string) {
  const auction = await getAuctionById(auctionId);
  if (auction.cameraId) return auction;
  const [updated] = await db
    .update(auctions)
    .set({ cameraId: randomToken(), updatedAt: new Date() })
    .where(eq(auctions.id, auctionId))
    .returning();
  return updated;
}

/** Anula la clave (y corta la transmisión si está en curso). */
export async function disableObsStream(auctionId: string) {
  const auction = await getAuctionById(auctionId);
  if (!auction.cameraId) throw Errors.badRequest('Esta subasta no tiene una transmisión habilitada');

  // Best effort: si OBS está transmitiendo, que nginx lo desconecte ya
  const name = streamKeyFor(auction.cameraId);
  await fetch(`${env.rtsp.mediaUrl}/control/drop/publisher?app=live&name=${encodeURIComponent(name)}`).catch(() => undefined);

  const [updated] = await db
    .update(auctions)
    .set({ cameraId: null, updatedAt: new Date() })
    .where(eq(auctions.id, auctionId))
    .returning();
  return updated;
}

/**
 * Validación que pide el media-server cuando OBS empieza a transmitir.
 * Acepta solo una clave vigente de una subasta próxima o activa.
 */
export async function validatePublishKey(name: string | undefined) {
  if (!name || !name.startsWith(STREAM_PREFIX)) return false;
  const cameraId = name.slice(STREAM_PREFIX.length);
  if (!cameraId) return false;
  const [auction] = await db
    .select({ id: auctions.id, status: auctions.status })
    .from(auctions)
    .where(eq(auctions.cameraId, cameraId));
  return Boolean(auction && (auction.status === 'ACTIVA' || auction.status === 'PROXIMA'));
}

/** ¿Está llegando señal? (existe la playlist HLS en el media-server) */
async function isReceiving(cameraId: string) {
  try {
    const res = await fetch(`${env.rtsp.mediaUrl}/hls/${streamKeyFor(cameraId)}/index.m3u8`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Datos de transmisión para el panel del martillero. */
export async function getStreamInfo(auctionId: string) {
  const auction = await getAuctionById(auctionId);
  const base = { mode: env.video.mode, cameraId: auction.cameraId };
  if (env.video.mode !== 'obs' || !auction.cameraId) return { ...base, rtmpUrl: null, streamKey: null, receiving: false };
  return {
    ...base,
    rtmpUrl: env.video.rtmpPublicUrl,
    streamKey: streamKeyFor(auction.cameraId),
    receiving: await isReceiving(auction.cameraId),
  };
}

// ---------- Modo rtsp-manager (VIDEO_MODE=rtsp) ----------

/** Prende la cámara de una subasta: crea/actualiza el stream en rtsp-manager y guarda el cameraId. */
export async function startCamera(auctionId: string, name: string, rtspUrl: string) {
  const auction = await getAuctionById(auctionId);

  // El cameraId lo generamos nosotros (y no rtsp-manager) para que, si el
  // stream falla al arrancar, el reintento reuse el mismo id: rtsp-manager
  // guarda la configuración aunque responda error, y si dejáramos que él
  // genere el UUID cada intento fallido quedaría un stream huérfano.
  const requestedId = auction.cameraId ?? randomUUID();
  const result = await callControlPlane('/streams', {
    method: 'POST',
    body: JSON.stringify({ cameraId: requestedId, name, rtspUrl }),
  });

  const cameraId = result.data?.configuration?.cameraId ?? requestedId;
  const [updated] = await db.update(auctions).set({ cameraId, updatedAt: new Date() }).where(eq(auctions.id, auctionId)).returning();
  return updated;
}

/** Apaga y desvincula la cámara de una subasta. */
export async function stopCamera(auctionId: string) {
  const auction = await getAuctionById(auctionId);
  if (!auction.cameraId) throw Errors.badRequest('Esta subasta no tiene una cámara activa');

  await callControlPlane(`/streams/${auction.cameraId}`, { method: 'DELETE' });

  const [updated] = await db.update(auctions).set({ cameraId: null, updatedAt: new Date() }).where(eq(auctions.id, auctionId)).returning();
  return updated;
}

/** Arma la ruta relativa (dentro del media server) para hls o dash de la subasta, si tiene cámara. */
export async function getStreamPaths(auctionId: string) {
  const auction = await getAuctionById(auctionId);
  if (!auction.cameraId) throw Errors.notFound('Esta subasta no tiene video en vivo');
  return {
    hls: `/hls/camera_${auction.cameraId}`,
    dash: `/dash/camera_${auction.cameraId}`,
  };
}

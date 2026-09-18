import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions } from '../db/schema';
import { env } from '../config/env';
import { Errors } from '../utils/AppError';
import { getAuctionById } from './auction.service';

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

/** Prende la cámara de una subasta: crea/actualiza el stream en rtsp-manager y guarda el cameraId. */
export async function startCamera(auctionId: string, name: string, rtspUrl: string) {
  const auction = await getAuctionById(auctionId);

  const result = await callControlPlane('/streams', {
    method: 'POST',
    body: JSON.stringify({ cameraId: auction.cameraId ?? undefined, name, rtspUrl }),
  });

  const cameraId = result.data!.configuration.cameraId;
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

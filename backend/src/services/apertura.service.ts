import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions } from '../db/schema';
import { broadcastRoomState } from './realtime.service';

/**
 * Cuando la cuenta regresiva llega a cero, la subasta pasa a ACTIVA
 * (pedido del cliente, nov 2026). Solo las publicadas. Además se sigue
 * abriendo sola si el martillero empieza a transmitir antes (live.service).
 * La sala abierta se entera por 'lot:change'.
 */
// Una subasta que quedó "próxima" con el horario vencido hace mucho (ej. se
// suspendió y nadie la actualizó) no se abre sola: la resuelve el admin.
const VENTANA_MS = 12 * 60 * 60 * 1000;

export async function abrirSubastasEnHorario() {
  const ahora = Date.now();
  const abiertas = await db
    .update(auctions)
    .set({ status: 'ACTIVA', updatedAt: new Date() })
    .where(
      and(
        eq(auctions.status, 'PROXIMA'),
        eq(auctions.published, true),
        lte(auctions.startsAt, new Date(ahora)),
        gte(auctions.startsAt, new Date(ahora - VENTANA_MS))
      )
    )
    .returning({ id: auctions.id });
  for (const { id } of abiertas) await broadcastRoomState(id).catch(() => undefined);
  return abiertas.map((a) => a.id);
}

const CADA_MS = 15_000;

/** Revisa cada 15 s (lo arranca server.ts; los tests llaman a la función directo). */
export function iniciarAperturaAutomatica() {
  const revisar = () =>
    abrirSubastasEnHorario().catch((err) => console.error('No se pudieron abrir las subastas en horario:', err));
  revisar();
  return setInterval(revisar, CADA_MS).unref();
}

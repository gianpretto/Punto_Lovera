import { useEffect, useState } from 'react';
import { api, uploadUrl } from './api';
import { makeCountdown, type Countdown, type Subasta } from '../interfaces/subasta';

// Subastas reales del backend (GET /api/subastas y /api/subastas/:id),
// adaptadas a la forma que ya usan las tarjetas del diseño (interfaces/subasta).

export type AuctionStatus = 'PROXIMA' | 'ACTIVA' | 'FINALIZADA' | 'CANCELADA';

export interface AuctionApi {
  id: string;
  title: string;
  description: string;
  location: string;
  coverImageUrl: string | null;
  startsAt: string;
  status: AuctionStatus;
}

export interface LotApi {
  id: string;
  number: number;
  title: string;
  description: string;
  currentPrice: string;
  sold: boolean;
  images: { url: string; position: number }[];
}

export interface AuctionDetailApi extends AuctionApi {
  lots: LotApi[];
}

// Texto del pill de estado, igual que en el diseño ("PRÓXIMA" con tilde)
const ESTADO: Record<AuctionStatus, string> = {
  PROXIMA: 'PRÓXIMA',
  ACTIVA: 'ACTIVA',
  FINALIZADA: 'FINALIZADA',
  CANCELADA: 'CANCELADA',
};

/** "Miércoles 11/11/25", como en el diseño */
export function formatFecha(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long' });
  const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fecha}`;
}

export function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function countdownTo(iso: string, now: number): Countdown {
  let s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  return makeCountdown(d, h, m, s - m * 60);
}

export function toSubasta(a: AuctionApi, now: number): Subasta {
  return {
    id: a.id,
    estado: ESTADO[a.status],
    titulo: a.title,
    ubicacion: a.location,
    descripcion: a.description,
    fecha: formatFecha(a.startsAt),
    hora: formatHora(a.startsAt),
    countdown: countdownTo(a.startsAt, now),
  };
}

/** Reloj que avanza cada segundo (para las cuentas regresivas). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Lista de subastas, opcionalmente filtrada por estado (orden: fecha de inicio). */
export function useAuctions(statuses?: AuctionStatus[]) {
  const [auctions, setAuctions] = useState<AuctionApi[] | null>(null);
  const key = statuses?.join(',') ?? '';

  useEffect(() => {
    let cancel = false;
    api
      .get<{ auctions: AuctionApi[] }>('/subastas')
      .then(({ auctions }) => {
        if (cancel) return;
        const wanted = key ? key.split(',') : null;
        setAuctions(wanted ? auctions.filter((a) => wanted.includes(a.status)) : auctions);
      })
      .catch(() => !cancel && setAuctions([]));
    return () => {
      cancel = true;
    };
  }, [key]);

  return auctions;
}

export function useAuction(id: string | undefined) {
  const [auction, setAuction] = useState<AuctionDetailApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    api
      .get<{ auction: AuctionDetailApi }>(`/subastas/${id}`)
      .then(({ auction }) => !cancel && setAuction(auction))
      .catch((err) => !cancel && setError(err instanceof Error ? err.message : 'No se pudo cargar la subasta'));
    return () => {
      cancel = true;
    };
  }, [id]);

  return { auction, error };
}

export function lotImages(lot: LotApi): string[] {
  return [...lot.images].sort((a, b) => a.position - b.position).map((i) => uploadUrl(i.url));
}

import type { AuctionApi, AuctionStatus } from '../services/auctions';

// Orden de las listas de subastas del rediseño: primero las que están en
// vivo, después las próximas (la más cercana primero) y al final las
// terminadas (la más reciente primero).
const PRIORIDAD: Record<AuctionStatus, number> = { ACTIVA: 0, PROXIMA: 1, FINALIZADA: 2, CANCELADA: 3 };

export function ordenarSubastas(subastas: AuctionApi[]): AuctionApi[] {
  return [...subastas].sort((a, b) => {
    const p = PRIORIDAD[a.status] - PRIORIDAD[b.status];
    if (p !== 0) return p;
    const diff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    return a.status === 'FINALIZADA' ? -diff : diff;
  });
}

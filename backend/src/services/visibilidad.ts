import type { JwtPayload } from '../utils/jwt';
import { Errors } from '../utils/AppError';

/**
 * Qué ve el público y qué ve el martillero/admin (pedidos del cliente, nov 2026):
 *
 * - Subastas ocultas (published = false): el admin las va cargando y recién
 *   las ve el público cuando las publica. Para el público no existen (404).
 * - Precio base interno: el público ve "SIN BASE". La API pública no manda
 *   `startingPrice`, y mientras nadie ofertó tampoco manda `currentPrice`
 *   (sería la base). La primera oferta mínima sí es la base: queda a la
 *   vista recién en la sala, como en un remate.
 */

export const esStaff = (user?: Pick<JwtPayload, 'role'> | null) =>
  user?.role === 'MARTILLERO' || user?.role === 'ADMIN';

/** Una subasta oculta solo la ven el martillero y los admins. */
export function assertVisible(auction: { published: boolean }, staff: boolean) {
  if (!auction.published && !staff) throw Errors.notFound('Subasta');
}

type LoteConPrecios = { startingPrice: string; currentPrice: string; leaderId: string | null };

/** Lote para el público: sin el precio base (y sin precio mientras no hay ofertas). */
export function lotePublico<T extends LoteConPrecios>(lot: T, staff: boolean) {
  if (staff) return lot;
  const { startingPrice: _base, ...resto } = lot;
  return { ...resto, currentPrice: lot.leaderId ? lot.currentPrice : null };
}

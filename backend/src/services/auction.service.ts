import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, bids, lotImages, lots } from '../db/schema';
import { removeUploadedFile } from '../middleware/upload.middleware';
import { Errors } from '../utils/AppError';

type AuctionStatus = (typeof auctions.$inferSelect)['status'];

/** Lista completa (admin y compatibilidad): por fecha de inicio. */
export async function listAuctions(statuses?: AuctionStatus[]) {
  return db.query.auctions.findMany({
    where: statuses?.length ? inArray(auctions.status, statuses) : undefined,
    orderBy: (a, { asc }) => asc(a.startsAt),
    with: { lots: { columns: { id: true } } },
  });
}

/**
 * Una página de subastas para las listas públicas, en el orden de la web:
 * primero las en vivo, después las próximas (la más cercana primero) y al
 * final las terminadas (la más reciente primero). La base devuelve solo esa
 * página (LIMIT/OFFSET) y el total para el paginador.
 */
export async function listAuctionsPage(statuses: AuctionStatus[] | undefined, page: number, pageSize: number) {
  const where = statuses?.length ? inArray(auctions.status, statuses) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(auctions).where(where);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const items = await db.query.auctions.findMany({
    where,
    orderBy: [
      sql`CASE ${auctions.status} WHEN 'ACTIVA' THEN 0 WHEN 'PROXIMA' THEN 1 WHEN 'FINALIZADA' THEN 2 ELSE 3 END`,
      sql`CASE WHEN ${auctions.status} IN ('FINALIZADA', 'CANCELADA') THEN NULL ELSE ${auctions.startsAt} END ASC NULLS LAST`,
      desc(auctions.startsAt),
      asc(auctions.id),
    ],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    with: { lots: { columns: { id: true } } },
  });

  return { auctions: items, total, page, pageSize, pages };
}

export async function getAuctionById(id: string) {
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, id),
    with: {
      lots: {
        with: { images: true },
        orderBy: (l, { asc }) => asc(l.number),
      },
    },
  });
  if (!auction) throw Errors.notFound('Subasta');
  return auction;
}

/**
 * Lote en remate ahora: el que eligió el martillero (si sigue sin vender)
 * o, si no eligió ninguno, el primer lote sin vender por número.
 */
export async function getCurrentLot(auctionId: string) {
  const [auction] = await db
    .select({ currentLotId: auctions.currentLotId })
    .from(auctions)
    .where(eq(auctions.id, auctionId));
  if (!auction) throw Errors.notFound('Subasta');

  if (auction.currentLotId) {
    const chosen = await db.query.lots.findFirst({
      where: and(eq(lots.id, auction.currentLotId), eq(lots.auctionId, auctionId)),
      with: { images: { orderBy: (i, { asc }) => asc(i.position) } },
    });
    if (chosen && !chosen.sold) return chosen;
  }

  const next = await db.query.lots.findFirst({
    where: and(eq(lots.auctionId, auctionId), eq(lots.sold, false)),
    orderBy: asc(lots.number),
    with: { images: { orderBy: (i, { asc }) => asc(i.position) } },
  });
  return next ?? null;
}

export async function setCurrentLot(auctionId: string, lotId: string | null) {
  if (lotId) {
    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, lotId), eq(lots.auctionId, auctionId)));
    if (!lot) throw Errors.notFound('Lote');
    if (lot.sold) throw Errors.badRequest('Ese lote ya fue adjudicado');
  }
  const [updated] = await db
    .update(auctions)
    .set({ currentLotId: lotId, updatedAt: new Date() })
    .where(eq(auctions.id, auctionId))
    .returning();
  if (!updated) throw Errors.notFound('Subasta');
}

export async function createAuction(
  createdById: string,
  data: { title: string; description: string; location: string; startsAt: Date; coverImageUrl?: string }
) {
  const [auction] = await db.insert(auctions).values({ ...data, createdById }).returning();
  return auction;
}

export async function updateAuction(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    coverImageUrl: string | null;
    status: AuctionStatus;
  }>
) {
  const before = await getAuctionById(id);
  const [auction] = await db
    .update(auctions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(auctions.id, id))
    .returning();
  // Si se cambió o quitó la portada, la imagen vieja (si era subida) ya no se usa
  if (data.coverImageUrl !== undefined && before.coverImageUrl !== data.coverImageUrl) {
    await removeUploadedFile(before.coverImageUrl);
  }
  return auction;
}

/** Guarda la portada recién subida (POST /subastas/:id/portada). */
export async function setAuctionCover(id: string, url: string) {
  return updateAuction(id, { coverImageUrl: url });
}

export async function deleteAuction(id: string) {
  const auction = await getAuctionById(id);
  const lotIds = auction.lots.map((l) => l.id);

  // Una subasta con lotes vendidos u ofertas tiene historial (compras,
  // crédito retenido de quien va ganando): no se borra, se cancela.
  if (auction.lots.some((l) => l.sold)) {
    throw Errors.badRequest('No se puede borrar una subasta con lotes vendidos. Podés marcarla como cancelada.');
  }
  if (lotIds.length > 0) {
    const [bid] = await db.select({ id: bids.id }).from(bids).where(inArray(bids.lotId, lotIds)).limit(1);
    if (bid) {
      throw Errors.badRequest('No se puede borrar una subasta que ya recibió ofertas. Podés marcarla como cancelada.');
    }
  }

  const images = lotIds.length
    ? await db.select({ url: lotImages.url }).from(lotImages).where(inArray(lotImages.lotId, lotIds))
    : [];
  // Los lotes, fotos, pases y chat se borran en cascada (FK onDelete: cascade)
  await db.delete(auctions).where(eq(auctions.id, id));
  await Promise.all([auction.coverImageUrl, ...images.map((i) => i.url)].map((url) => removeUploadedFile(url)));
}

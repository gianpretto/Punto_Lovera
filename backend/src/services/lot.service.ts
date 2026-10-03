import { and, eq, max, ne } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, bids, lotImages, lots } from '../db/schema';
import { removeUploadedFile } from '../middleware/upload.middleware';
import { Errors } from '../utils/AppError';

/**
 * Busca un lote. Si se pasa auctionId, además exige que el lote sea de esa
 * subasta (las rutas son /subastas/:auctionId/lotes/:lotId y no queremos
 * que se pueda tocar un lote de otra subasta cambiando el id de la URL).
 */
export async function getLotById(id: string, auctionId?: string) {
  const lot = await db.query.lots.findFirst({
    where: auctionId ? and(eq(lots.id, id), eq(lots.auctionId, auctionId)) : eq(lots.id, id),
    with: {
      images: { orderBy: (i, { asc }) => asc(i.position) },
      auction: true,
    },
  });
  if (!lot) throw Errors.notFound('Lote');
  return lot;
}

async function lotHasBids(lotId: string) {
  const [bid] = await db.select({ id: bids.id }).from(bids).where(eq(bids.lotId, lotId)).limit(1);
  return Boolean(bid);
}

// El número de lote es único dentro de la subasta (constraint
// lots_auction_number_unique): lo chequeamos antes para dar un error claro.
async function assertNumberFree(auctionId: string, number: number, exceptLotId?: string) {
  const [dup] = await db
    .select({ id: lots.id })
    .from(lots)
    .where(
      and(
        eq(lots.auctionId, auctionId),
        eq(lots.number, number),
        exceptLotId ? ne(lots.id, exceptLotId) : undefined
      )
    )
    .limit(1);
  if (dup) throw Errors.badRequest(`Ya existe el lote número ${number} en esta subasta`);
}

export async function createLot(
  auctionId: string,
  data: { number: number; title: string; description: string; startingPrice: number; bidIncrement?: number }
) {
  const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId));
  if (!auction) throw Errors.notFound('Subasta');
  await assertNumberFree(auctionId, data.number);

  const [lot] = await db
    .insert(lots)
    .values({
      auctionId,
      number: data.number,
      title: data.title,
      description: data.description,
      // Sin ofertas todavía: el precio actual arranca en el precio base
      startingPrice: String(data.startingPrice),
      currentPrice: String(data.startingPrice),
      bidIncrement: data.bidIncrement ? String(data.bidIncrement) : undefined,
    })
    .returning();
  return lot;
}

export async function updateLot(
  auctionId: string,
  id: string,
  data: Partial<{ number: number; title: string; description: string; startingPrice: number; bidIncrement: number }>
) {
  const current = await getLotById(id, auctionId);
  const { startingPrice, bidIncrement, ...rest } = data;

  const priceChanges = startingPrice !== undefined && Number(current.startingPrice) !== startingPrice;
  if (priceChanges) {
    if (current.sold) throw Errors.badRequest('No se puede cambiar el precio base de un lote vendido');
    if (await lotHasBids(id)) {
      throw Errors.badRequest('No se puede cambiar el precio base de un lote que ya recibió ofertas');
    }
  }
  if (rest.number !== undefined && rest.number !== current.number) {
    await assertNumberFree(auctionId, rest.number, id);
  }

  const [lot] = await db
    .update(lots)
    .set({
      ...rest,
      // Sin ofertas el precio actual es el precio base: se mueven juntos
      ...(priceChanges ? { startingPrice: String(startingPrice), currentPrice: String(startingPrice) } : {}),
      ...(bidIncrement !== undefined ? { bidIncrement: String(bidIncrement) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lots.id, id))
    .returning();
  return lot;
}

export async function deleteLot(auctionId: string, id: string) {
  const lot = await getLotById(id, auctionId);
  if (lot.sold) throw Errors.badRequest('No se puede borrar un lote vendido');
  if (await lotHasBids(id)) throw Errors.badRequest('No se puede borrar un lote que ya recibió ofertas');

  await db.transaction(async (tx) => {
    // Si era el lote elegido en la sala, la sala vuelve al primero sin vender
    await tx
      .update(auctions)
      .set({ currentLotId: null, updatedAt: new Date() })
      .where(and(eq(auctions.id, auctionId), eq(auctions.currentLotId, id)));
    await tx.delete(lots).where(eq(lots.id, id)); // las fotos se borran en cascada
  });
  await Promise.all(lot.images.map((i) => removeUploadedFile(i.url)));
}

export async function addLotImages(auctionId: string, lotId: string, urls: string[]) {
  await getLotById(lotId, auctionId);
  if (urls.length === 0) throw Errors.badRequest('Elegí al menos una imagen');

  // Las fotos nuevas van al final de las que ya tiene el lote
  const [{ last }] = await db
    .select({ last: max(lotImages.position) })
    .from(lotImages)
    .where(eq(lotImages.lotId, lotId));
  const start = last === null ? 0 : last + 1;

  await db.insert(lotImages).values(urls.map((url, i) => ({ lotId, url, position: start + i })));
  return getLotById(lotId);
}

export async function deleteLotImage(auctionId: string, lotId: string, imageId: string) {
  await getLotById(lotId, auctionId);
  const [image] = await db
    .delete(lotImages)
    .where(and(eq(lotImages.id, imageId), eq(lotImages.lotId, lotId)))
    .returning();
  if (!image) throw Errors.notFound('Imagen');
  await removeUploadedFile(image.url);
  return getLotById(lotId);
}

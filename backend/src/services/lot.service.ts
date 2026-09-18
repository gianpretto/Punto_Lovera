import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, lotImages, lots } from '../db/schema';
import { Errors } from '../utils/AppError';

export async function getLotById(id: string) {
  const lot = await db.query.lots.findFirst({
    where: eq(lots.id, id),
    with: {
      images: { orderBy: (i, { asc }) => asc(i.position) },
      auction: true,
    },
  });
  if (!lot) throw Errors.notFound('Lote');
  return lot;
}

export async function createLot(
  auctionId: string,
  data: { number: number; title: string; description: string; startingPrice: number; bidIncrement?: number }
) {
  const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId));
  if (!auction) throw Errors.notFound('Subasta');

  const [lot] = await db
    .insert(lots)
    .values({
      auctionId,
      number: data.number,
      title: data.title,
      description: data.description,
      startingPrice: String(data.startingPrice),
      currentPrice: String(data.startingPrice),
      bidIncrement: data.bidIncrement ? String(data.bidIncrement) : undefined,
    })
    .returning();
  return lot;
}

export async function updateLot(
  id: string,
  data: Partial<{ number: number; title: string; description: string; startingPrice: number; bidIncrement: number }>
) {
  await getLotById(id);
  const { startingPrice, bidIncrement, ...rest } = data;
  const [lot] = await db
    .update(lots)
    .set({
      ...rest,
      ...(startingPrice !== undefined ? { startingPrice: String(startingPrice) } : {}),
      ...(bidIncrement !== undefined ? { bidIncrement: String(bidIncrement) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lots.id, id))
    .returning();
  return lot;
}

export async function deleteLot(id: string) {
  await getLotById(id);
  await db.delete(lots).where(eq(lots.id, id));
}

export async function addLotImages(lotId: string, urls: string[]) {
  await getLotById(lotId);
  await db.insert(lotImages).values(urls.map((url, i) => ({ lotId, url, position: i })));
  return getLotById(lotId);
}

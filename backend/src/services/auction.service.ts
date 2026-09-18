import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions } from '../db/schema';
import { Errors } from '../utils/AppError';

type AuctionStatus = (typeof auctions.$inferSelect)['status'];

export async function listAuctions(status?: AuctionStatus) {
  return db.query.auctions.findMany({
    where: status ? eq(auctions.status, status) : undefined,
    orderBy: (a, { asc }) => asc(a.startsAt),
    with: { lots: { columns: { id: true } } },
  });
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
    coverImageUrl: string;
    status: AuctionStatus;
  }>
) {
  await getAuctionById(id);
  const [auction] = await db
    .update(auctions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(auctions.id, id))
    .returning();
  return auction;
}

export async function deleteAuction(id: string) {
  await getAuctionById(id);
  await db.delete(auctions).where(eq(auctions.id, id));
}

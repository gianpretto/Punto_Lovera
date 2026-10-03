import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, chatMessages, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import * as auctionService from './auction.service';
import * as bidService from './bid.service';
import * as purchaseService from './purchase.service';
import { getIo } from '../sockets/io';

/**
 * Camino único para registrar una puja, sea que llegue por HTTP (fallback /
 * tests) o por WebSocket (uso normal en la sala de subasta en vivo). Además
 * de guardar la puja, deja un mensaje de sistema en el chat ("Fulano ofreció
 * $X") y emite ambos eventos a todos los que estén mirando esa subasta.
 */
export async function placeBidAndBroadcast(lotId: string, userId: string, amount: number) {
  const result = await bidService.placeBid(lotId, userId, amount);

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId));

  const [chatMessage] = await db
    .insert(chatMessages)
    .values({
      auctionId: result.lot.auctionId,
      userId,
      text: `ofreció $${Number(result.bid.amount).toLocaleString('es-AR')}`,
      isOffer: true,
    })
    .returning();

  const io = getIo();
  const room = `auction:${result.lot.auctionId}`;
  if (io) {
    io.to(room).emit('bid:new', {
      lotId: result.lot.id,
      currentPrice: Number(result.lot.currentPrice),
      minNextBid: Number(result.lot.currentPrice) + Number(result.lot.bidIncrement),
      leaderId: result.lot.leaderId,
      bid: { ...result.bid, amount: Number(result.bid.amount) },
    });
    io.to(room).emit('chat:message', {
      id: chatMessage.id,
      user: user ? `${user.firstName} ${user.lastName}` : 'Usuario',
      text: chatMessage.text,
      time: chatMessage.createdAt,
      isOffer: true,
    });
  }

  return result;
}

export async function sendChatMessage(auctionId: string, userId: string, text: string) {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return null;

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId));

  const [message] = await db
    .insert(chatMessages)
    .values({ auctionId, userId, text: trimmed, isOffer: false })
    .returning();

  const payload = {
    id: message.id,
    user: user ? `${user.firstName} ${user.lastName}` : 'Usuario',
    text: message.text,
    time: message.createdAt,
    isOffer: false,
  };

  getIo()?.to(`auction:${auctionId}`).emit('chat:message', payload);
  return payload;
}

export async function getChatHistory(auctionId: string) {
  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.auctionId, auctionId),
    orderBy: (m, { asc }) => asc(m.createdAt),
    limit: 200,
    with: { user: { columns: { firstName: true, lastName: true } } },
  });
  return messages.map((m) => ({
    id: m.id,
    user: `${m.user.firstName} ${m.user.lastName}`,
    text: m.text,
    time: m.createdAt,
    isOffer: m.isOffer,
  }));
}

// ---------- Estado de la sala (qué lote se remata ahora) ----------

type CurrentLot = NonNullable<Awaited<ReturnType<typeof auctionService.getCurrentLot>>>;

function lotPayload(lot: CurrentLot) {
  const currentPrice = Number(lot.currentPrice);
  const bidIncrement = Number(lot.bidIncrement);
  return {
    id: lot.id,
    number: lot.number,
    title: lot.title,
    description: lot.description,
    startingPrice: Number(lot.startingPrice),
    currentPrice,
    bidIncrement,
    minNextBid: currentPrice + bidIncrement,
    leaderId: lot.leaderId,
    images: lot.images.map((i) => i.url),
  };
}

/**
 * Todo lo que necesita la sala al entrar (evento 'auction:state'): datos
 * de la subasta y el lote que se está rematando. lot = null cuando ya no
 * quedan lotes sin vender.
 */
export async function getRoomState(auctionId: string) {
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
    with: { createdBy: { columns: { firstName: true, lastName: true } } },
  });
  if (!auction) throw Errors.notFound('Subasta');

  const lot = await auctionService.getCurrentLot(auctionId);
  return {
    auction: {
      id: auction.id,
      title: auction.title,
      location: auction.location,
      status: auction.status,
      cameraId: auction.cameraId,
      martillero: auction.createdBy ? `${auction.createdBy.firstName} ${auction.createdBy.lastName}` : null,
    },
    lot: lot ? lotPayload(lot) : null,
  };
}

/** Reenvía el estado de la sala a todos (ej: se prendió/apagó la cámara). */
export async function broadcastRoomState(auctionId: string) {
  const state = await getRoomState(auctionId);
  getIo()?.to(`auction:${auctionId}`).emit('lot:change', state);
  return state;
}

/** El martillero pasa a otro lote: se avisa a toda la sala. */
export async function setCurrentLotAndBroadcast(auctionId: string, lotId: string | null) {
  await auctionService.setCurrentLot(auctionId, lotId);
  return broadcastRoomState(auctionId);
}

/**
 * Cierra el lote (adjudica al mejor postor), avisa a la sala con
 * 'lot:sold' y avanza solo al siguiente lote sin vender ('lot:change').
 */
export async function closeLotAndBroadcast(lotId: string) {
  const purchase = await purchaseService.closeLotAndCreatePurchase(lotId);
  const lot = await db.query.lots.findFirst({ where: (l, { eq }) => eq(l.id, lotId) });
  if (!lot) return purchase;

  const [winner] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, purchase.userId));

  getIo()?.to(`auction:${lot.auctionId}`).emit('lot:sold', {
    lotId,
    amount: Number(purchase.totalAmount),
    winner: winner ? `${winner.firstName} ${winner.lastName}` : 'Usuario',
  });

  await auctionService.setCurrentLot(lot.auctionId, null);
  await broadcastRoomState(lot.auctionId);
  return purchase;
}

import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { chatMessages, users } from '../db/schema';
import * as bidService from './bid.service';
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

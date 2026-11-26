import { and, asc, eq, gte, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '../config/db';
import { auctions, chatMessages, lots, users } from '../db/schema';
import { Errors } from '../utils/AppError';
import * as auctionService from './auction.service';
import * as bidService from './bid.service';
import * as purchaseService from './purchase.service';
import { hasSanction, type SanctionType } from './martillero.service';
import { minNextBidOf } from './bid.service';
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
      bidId: result.bid.id,
    })
    .returning();

  const io = getIo();
  const room = `auction:${result.lot.auctionId}`;
  if (io) {
    io.to(room).emit('bid:new', {
      lotId: result.lot.id,
      currentPrice: Number(result.lot.currentPrice),
      minNextBid: minNextBidOf(result.lot),
      leaderId: result.lot.leaderId,
      bid: { ...result.bid, amount: Number(result.bid.amount) },
    });
    io.to(room).emit('chat:message', {
      id: chatMessage.id,
      userId,
      user: user ? `${user.firstName} ${user.lastName}` : 'Usuario',
      text: chatMessage.text,
      time: chatMessage.createdAt,
      isOffer: true,
      bidId: result.bid.id,
      staff: false,
      privateUserId: null,
    });
  }

  return result;
}

// ---------- Chat (público y privado con el martillero) ----------

const ES_STAFF = (role: string) => role === 'MARTILLERO' || role === 'ADMIN';

/** Salas de socket.io para mandar los privados: martilleros/admins y cada usuario */
export const salaStaff = (auctionId: string) => `auction:${auctionId}:staff`;
export const salaUsuario = (auctionId: string, userId: string) => `auction:${auctionId}:u:${userId}`;

type FilaChat = typeof chatMessages.$inferSelect & {
  user: { firstName: string; lastName: string; role: string };
};

function chatPayload(m: FilaChat) {
  return {
    id: m.id,
    userId: m.userId,
    user: `${m.user.firstName} ${m.user.lastName}`,
    text: m.text,
    time: m.createdAt,
    isOffer: m.isOffer,
    bidId: m.bidId,
    // Martillero/admin: el chat lo destaca
    staff: ES_STAFF(m.user.role),
    // Privado entre ese usuario y el martillero (null = público)
    privateUserId: m.privateUserId,
  };
}

/**
 * Mensaje del chat de la sala.
 * - privado: el usuario le escribe solo al martillero (lo ven él y los
 *   martilleros/admins).
 * - paraUserId: el martillero/admin le contesta en privado a ese usuario.
 */
export async function sendChatMessage(
  auctionId: string,
  userId: string,
  text: string,
  opciones: { privado?: boolean; paraUserId?: string } = {}
) {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return null;

  // El chat es de la sala en vivo: fuera del remate no se escribe
  const [auction] = await db.select({ status: auctions.status }).from(auctions).where(eq(auctions.id, auctionId));
  if (!auction) throw Errors.notFound('Subasta');
  if (auction.status !== 'ACTIVA') throw Errors.badRequest('El chat se habilita cuando el remate está en vivo');
  if ((await hasSanction(auctionId, userId, 'SILENCIADO')) || (await hasSanction(auctionId, userId, 'EXPULSADO'))) {
    throw Errors.forbidden('El martillero te silenció en este remate');
  }

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw Errors.unauthorized();
  const staff = ES_STAFF(user.role);

  let privateUserId: string | null = null;
  if (opciones.paraUserId) {
    if (!staff) throw Errors.forbidden('Solo el martillero puede contestar en privado');
    const [destino] = await db.select({ role: users.role }).from(users).where(eq(users.id, opciones.paraUserId));
    if (!destino || ES_STAFF(destino.role)) throw Errors.badRequest('Ese usuario no existe');
    privateUserId = opciones.paraUserId;
  } else if (opciones.privado) {
    if (staff) throw Errors.badRequest('Elegí a qué usuario contestarle');
    privateUserId = userId;
  }

  const [message] = await db
    .insert(chatMessages)
    .values({ auctionId, userId, text: trimmed, isOffer: false, privateUserId })
    .returning();

  const payload = chatPayload({ ...message, user });
  const io = getIo();
  if (privateUserId) {
    // Solo ese usuario (todas sus pestañas) y los martilleros/admins de la sala
    io?.to([salaStaff(auctionId), salaUsuario(auctionId, privateUserId)]).emit('chat:message', payload);
  } else {
    io?.to(`auction:${auctionId}`).emit('chat:message', payload);
  }
  return payload;
}

/**
 * Todos los mensajes privados de una subasta (panel del martillero), sin
 * límite de tiempo: las conversaciones con cada usuario.
 */
export async function getPrivateMessages(auctionId: string) {
  const messages = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.auctionId, auctionId), isNotNull(chatMessages.privateUserId)),
    orderBy: asc(chatMessages.createdAt),
    limit: 500,
    with: { user: { columns: { firstName: true, lastName: true, role: true } } },
  });
  return messages.map(chatPayload);
}

/** Subasta a la que pertenece un lote (para validar la sala en las pujas). */
export async function getLotAuctionId(lotId: string) {
  const [lot] = await db.select({ auctionId: lots.auctionId }).from(lots).where(eq(lots.id, lotId));
  if (!lot) throw Errors.notFound('Lote');
  return lot.auctionId;
}

// Al entrar a la sala solo se muestra el chat reciente: los últimos
// CHAT_HISTORIAL_MAX mensajes de los últimos CHAT_HISTORIAL_MINUTOS (no tiene
// sentido ver la charla de hace horas). En la base quedan todos.
const CHAT_HISTORIAL_MAX = 40;
const CHAT_HISTORIAL_MINUTOS = 30;

/**
 * Historial al entrar a la sala. Los privados: el martillero/admin los ve
 * todos; un usuario, solo los suyos; un invitado, ninguno.
 */
export async function getChatHistory(auctionId: string, viewer: { userId?: string; staff: boolean } = { staff: false }) {
  const desde = new Date(Date.now() - CHAT_HISTORIAL_MINUTOS * 60_000);
  const privados = viewer.staff
    ? undefined
    : viewer.userId
      ? or(isNull(chatMessages.privateUserId), eq(chatMessages.privateUserId, viewer.userId))
      : isNull(chatMessages.privateUserId);
  const messages = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.auctionId, auctionId), gte(chatMessages.createdAt, desde), privados),
    // Los más nuevos (desc + limit) y después en orden cronológico
    orderBy: (m, { desc }) => desc(m.createdAt),
    limit: CHAT_HISTORIAL_MAX,
    with: { user: { columns: { firstName: true, lastName: true, role: true } } },
  });
  return messages.reverse().map(chatPayload);
}

// ---------- Estado de la sala (qué lote se remata ahora) ----------

type CurrentLot = NonNullable<Awaited<ReturnType<typeof auctionService.getCurrentLot>>>;

// staff: el martillero/admin ve el precio base; el público, "sin base"
// (sin precio actual hasta la primera oferta). Ver visibilidad.ts.
function lotPayload(lot: CurrentLot, staff: boolean) {
  const bidIncrement = Number(lot.bidIncrement);
  return {
    id: lot.id,
    number: lot.number,
    bis: lot.bis,
    title: lot.title,
    description: lot.description,
    ...(staff ? { startingPrice: Number(lot.startingPrice) } : {}),
    currentPrice: lot.leaderId || staff ? Number(lot.currentPrice) : null,
    bidIncrement,
    minNextBid: minNextBidOf(lot),
    // La mínima la fijó el martillero a mano (no es precio + incremento)
    minNextBidManual: lot.nextMinBid != null,
    leaderId: lot.leaderId,
    images: lot.images.map((i) => i.url),
  };
}

/**
 * Todo lo que necesita la sala al entrar (evento 'auction:state'): datos
 * de la subasta y el lote que se está rematando. lot = null cuando ya no
 * quedan lotes sin vender.
 */
export async function getRoomState(auctionId: string, staff = false) {
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
      published: auction.published,
      // Nunca la clave (camera_id): solo si la transmisión está habilitada
      cameraOn: Boolean(auction.cameraId),
      martillero: auction.createdBy ? `${auction.createdBy.firstName} ${auction.createdBy.lastName}` : null,
    },
    lot: lot ? lotPayload(lot, staff) : null,
  };
}

/**
 * Reenvía el estado de la sala a todos (ej: se prendió/apagó la cámara).
 * Devuelve la versión del martillero/admin (con el precio base): la usan
 * las respuestas HTTP de los controles del martillero.
 */
export async function broadcastRoomState(auctionId: string) {
  const state = await getRoomState(auctionId);
  getIo()?.to(`auction:${auctionId}`).emit('lot:change', state);
  return getRoomState(auctionId, true);
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

// ---------- Moderación y controles del martillero ----------

/** Una oferta anulada: la sala la saca de la lista y recibe el lote recalculado. */
export async function broadcastBidVoided(auctionId: string, bidId: string, lotId: string) {
  getIo()?.to(`auction:${auctionId}`).emit('bid:voided', { bidId, lotId });
  return broadcastRoomState(auctionId);
}

/**
 * Avisa al usuario sancionado (todas sus pestañas en esa sala). Si lo
 * expulsan, además lo saca de la sala: no recibe más nada de ese remate.
 */
export async function notifySanction(auctionId: string, userId: string, type: SanctionType, active: boolean) {
  const io = getIo();
  if (!io) return;
  const room = `auction:${auctionId}`;
  const sockets = await io.in(room).fetchSockets();
  for (const s of sockets) {
    if (s.data.userId !== userId) continue;
    s.emit('auction:sanction', { auctionId, type, active });
    if (type === 'EXPULSADO' && active) {
      s.emit('auction:error', { code: 'EXPULSADO', message: 'El martillero te expulsó de este remate' });
      s.leave(room);
    }
  }
}

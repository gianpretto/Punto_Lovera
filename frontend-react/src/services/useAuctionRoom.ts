import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

// Sala de subasta en vivo: conecta con el Socket.io del backend
// (backend/src/sockets/bidding.socket.ts). Con token se puede pujar y
// chatear; sin token se entra como espectador.

export interface RoomLot {
  id: string;
  number: number;
  title: string;
  description: string;
  startingPrice: number;
  currentPrice: number;
  bidIncrement: number;
  minNextBid: number;
  /** Usuario que va ganando el lote (null = sin pujas) */
  leaderId: string | null;
  images: string[];
}

export interface RoomState {
  auction: {
    id: string;
    title: string;
    location: string;
    status: 'PROXIMA' | 'ACTIVA' | 'FINALIZADA' | 'CANCELADA';
    /** Transmisión habilitada (la clave de OBS nunca llega al navegador) */
    cameraOn: boolean;
    martillero: string | null;
  };
  /** null = ya no quedan lotes sin vender */
  lot: RoomLot | null;
}

export interface ChatMessage {
  id?: string;
  /** Quién lo escribió (null/ausente = aviso del sistema) */
  userId?: string | null;
  user: string;
  text: string;
  time: string;
  isOffer?: boolean;
  /** Oferta: id de la puja (si el backend lo manda), para marcarla anulada */
  bidId?: string;
  /** Oferta anulada por el martillero */
  anulada?: boolean;
}

interface ServerMessage {
  id: string;
  userId?: string | null;
  user: string;
  text: string;
  time: string;
  isOffer: boolean;
  bidId?: string;
}

/** Sanciones del martillero sobre el usuario en este remate */
export interface Sanciones {
  silenciado: boolean;
  expulsado: boolean;
}

interface Handlers {
  /** Puja o mensaje rechazado por el backend (sin crédito, puja baja, etc). */
  onError?: (message: string) => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const toChat = (m: ServerMessage): ChatMessage => ({
  id: m.id,
  userId: m.userId ?? null,
  bidId: m.bidId,
  user: m.user,
  text: m.text,
  time: formatTime(m.time),
  isOffer: m.isOffer,
});

// El chat de la sala muestra solo los últimos mensajes: los viejos se van
// descartando (el backend además manda solo lo reciente al entrar)
const MAX_MENSAJES = 60;
const recortar = (lista: ChatMessage[]) =>
  lista.length > MAX_MENSAJES ? lista.slice(-MAX_MENSAJES) : lista;

export function useAuctionRoom(
  auctionId: string | undefined,
  token: string | null,
  handlers: Handlers = {},
  /** Pase de invitado (link temporal): permite mirar sin cuenta */
  pase: string | null = null
) {
  const [state, setState] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El backend no lo dejó entrar: sin sesión y sin pase válido */
  const [authRequired, setAuthRequired] = useState(false);
  const [sanciones, setSanciones] = useState<Sanciones>({ silenciado: false, expulsado: false });
  // Expulsado: no se vuelve a entrar al reconectar
  const expulsadoRef = useRef(false);

  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    // Otra subasta (o se cerró la sesión): nada de la sala anterior
    setState(null);
    setMessages([]);
    setError(null);
    setAuthRequired(false);
    setSanciones({ silenciado: false, expulsado: false });
    expulsadoRef.current = false;
    if (!auctionId) return;

    // Mismo origen en dev (Vite proxea /socket.io) o VITE_API_URL en prod
    const socket = io(API_URL || undefined, {
      auth: { ...(token ? { token } : {}), ...(pase ? { pase } : {}) },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (expulsadoRef.current) return;
      setError(null);
      // Al reconectar se vuelve a entrar a la sala y se resincroniza todo
      socket.emit('auction:join', { auctionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => {
      setConnected(false);
      setError('No se pudo conectar con la sala en vivo. Reintentando...');
    });

    socket.on('auction:state', (s: RoomState) => setState(s));
    socket.on('lot:change', (s: RoomState) => setState(s));
    socket.on('auction:error', ({ message, code }: { message: string; code?: string }) => {
      setError(message);
      if (code === 'AUTH_REQUIRED') setAuthRequired(true);
      if (code === 'EXPULSADO') {
        expulsadoRef.current = true;
        setSanciones((s) => ({ ...s, expulsado: true }));
      }
    });

    socket.on(
      'auction:sanction',
      (s: { auctionId: string; type: 'SILENCIADO' | 'EXPULSADO'; active: boolean }) => {
        if (s.auctionId !== auctionId) return;
        if (s.type === 'EXPULSADO') {
          expulsadoRef.current = s.active;
          setSanciones((prev) => ({ ...prev, expulsado: s.active }));
        } else {
          setSanciones((prev) => ({ ...prev, silenciado: s.active }));
        }
      }
    );

    // El martillero anuló una oferta: queda tachada en el historial (el
    // precio y quién va ganando llegan recalculados por lot:change)
    socket.on('bid:voided', (v: { bidId: string; lotId: string }) => {
      setMessages((prev) => prev.map((m) => (m.isOffer && m.bidId === v.bidId ? { ...m, anulada: true } : m)));
    });

    socket.on('chat:history', (history: ServerMessage[]) => setMessages(recortar(history.map(toChat))));
    socket.on('chat:message', (m: ServerMessage) => setMessages((prev) => recortar([...prev, toChat(m)])));

    socket.on('bid:new', (b: { lotId: string; currentPrice: number; minNextBid: number; leaderId: string }) => {
      setState((prev) =>
        prev?.lot && prev.lot.id === b.lotId
          ? {
              ...prev,
              lot: { ...prev.lot, currentPrice: b.currentPrice, minNextBid: b.minNextBid, leaderId: b.leaderId },
            }
          : prev
      );
    });

    socket.on('lot:sold', ({ amount, winner }: { lotId: string; amount: number; winner: string }) => {
      // Aviso local (no queda en el historial del backend)
      setMessages((prev) => recortar([
        ...prev,
        {
          user: 'Martillero',
          text: `¡Adjudicado a ${winner} por $${amount.toLocaleString('es-AR')}!`,
          time: formatTime(new Date().toISOString()),
        },
      ]));
    });

    const onError = ({ message }: { message: string }) => handlersRef.current.onError?.(message);
    socket.on('bid:error', onError);
    socket.on('chat:error', onError);

    return () => {
      socket.emit('auction:leave', { auctionId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auctionId, token, pase]);

  const placeBid = useCallback((lotId: string, amount: number) => {
    socketRef.current?.emit('bid:place', { lotId, amount });
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (!auctionId) return;
      socketRef.current?.emit('chat:message', { auctionId, text });
    },
    [auctionId]
  );

  return { state, messages, connected, error, authRequired, sanciones, placeBid, sendMessage };
}

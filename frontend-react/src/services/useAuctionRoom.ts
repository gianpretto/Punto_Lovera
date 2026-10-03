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
  images: string[];
}

export interface RoomState {
  auction: {
    id: string;
    title: string;
    location: string;
    status: 'PROXIMA' | 'ACTIVA' | 'FINALIZADA' | 'CANCELADA';
    cameraId: string | null;
    martillero: string | null;
  };
  /** null = ya no quedan lotes sin vender */
  lot: RoomLot | null;
}

export interface ChatMessage {
  id?: string;
  user: string;
  text: string;
  time: string;
  isOffer?: boolean;
}

interface ServerMessage {
  id: string;
  user: string;
  text: string;
  time: string;
  isOffer: boolean;
}

interface Handlers {
  /** Puja o mensaje rechazado por el backend (sin crédito, puja baja, etc). */
  onError?: (message: string) => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const toChat = (m: ServerMessage): ChatMessage => ({
  id: m.id,
  user: m.user,
  text: m.text,
  time: formatTime(m.time),
  isOffer: m.isOffer,
});

export function useAuctionRoom(auctionId: string | undefined, token: string | null, handlers: Handlers = {}) {
  const [state, setState] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!auctionId) return;

    // Mismo origen en dev (Vite proxea /socket.io) o VITE_API_URL en prod
    const socket = io(API_URL || undefined, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
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
    socket.on('auction:error', ({ message }: { message: string }) => setError(message));

    socket.on('chat:history', (history: ServerMessage[]) => setMessages(history.map(toChat)));
    socket.on('chat:message', (m: ServerMessage) => setMessages((prev) => [...prev, toChat(m)]));

    socket.on('bid:new', (b: { lotId: string; currentPrice: number; minNextBid: number }) => {
      setState((prev) =>
        prev?.lot && prev.lot.id === b.lotId
          ? { ...prev, lot: { ...prev.lot, currentPrice: b.currentPrice, minNextBid: b.minNextBid } }
          : prev
      );
    });

    socket.on('lot:sold', ({ amount, winner }: { lotId: string; amount: number; winner: string }) => {
      // Aviso local (no queda en el historial del backend)
      setMessages((prev) => [
        ...prev,
        {
          user: 'Martillero',
          text: `¡Adjudicado a ${winner} por $${amount.toLocaleString('es-AR')}!`,
          time: formatTime(new Date().toISOString()),
        },
      ]);
    });

    const onError = ({ message }: { message: string }) => handlersRef.current.onError?.(message);
    socket.on('bid:error', onError);
    socket.on('chat:error', onError);

    return () => {
      socket.emit('auction:leave', { auctionId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auctionId, token]);

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

  return { state, messages, connected, error, placeBid, sendMessage };
}

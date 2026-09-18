import { Server } from 'socket.io';

// Referencia global simple al server de sockets, para poder emitir eventos
// desde los controllers REST (ej: cuando se aprueba una puja por HTTP)
// sin tener que pasar `io` por parámetro a través de toda la app.
let ioInstance: Server | null = null;

export function setIo(io: Server) {
  ioInstance = io;
}

export function getIo(): Server | null {
  return ioInstance;
}

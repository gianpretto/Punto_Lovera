import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Sala de remate en vivo por Socket.io: estado al entrar, pujas, chat,
// cambio de lote por el martillero y cierre/adjudicación del lote.
// Los tests son pasos de un mismo remate y dependen del anterior.

let app: TestApp;
let A: string; // admin / martillero
let U: string; // usuario con saldo y datos completos
let auctionId: string;
let lot1: { id: string; title: string };
let lot2: { id: string; title: string };
let user: ReturnType<TestApp['room']>;
let spectator: ReturnType<TestApp['room']>;
let pase: string;
let winningAmount: number; // puja ganadora del lote 1

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');

  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  [lot1, lot2] = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots;
  await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
  // Sin cuenta solo se entra a mirar con un pase de invitado
  pase = (await app.api('POST', `/subastas/${auctionId}/pases`, { label: 'espectador', hours: 2 }, A)).data.pass.token;
});
afterAll(async () => {
  await app?.close();
});

describe('Sala en vivo (Socket.io)', () => {
  let st: { lot: { id: string; currentPrice: number; bidIncrement: number; minNextBid: number }; auction: { martillero: unknown } };
  it('al entrar se recibe el estado con el lote 1 en remate y el historial del chat', async () => {
    expect(lot1 && lot2).toBeTruthy();
    user = app.room({ token: U });
    spectator = app.room({ pase });
    user.emit('auction:join', { auctionId });
    spectator.emit('auction:join', { auctionId });

    st = await user.waitFor('auction:state');
    expect(st.lot?.id).toBe(lot1.id);
    expect(st.lot.minNextBid).toBe(st.lot.currentPrice + st.lot.bidIncrement);
    expect(typeof st.auction.martillero).toBe('string');

    await spectator.waitFor('auction:state');
    expect(Array.isArray(await user.waitFor('chat:history'))).toBe(true);
  });

  it('el espectador (pase de invitado) no puede pujar', async () => {
    spectator.emit('bid:place', { lotId: lot1.id, amount: st.lot.minNextBid });
    expect((await spectator.waitFor('bid:error')).message).toMatch(/iniciar sesión/);
  });

  it('rechaza una puja menor a la mínima', async () => {
    user.emit('bid:place', { lotId: lot1.id, amount: st.lot.minNextBid - 1 });
    expect((await user.waitFor('bid:error')).message).toMatch(/mínima/);
  });

  it('rechaza una puja sin crédito suficiente', async () => {
    user.emit('bid:place', { lotId: lot1.id, amount: 10_000_000 });
    expect((await user.waitFor('bid:error')).message).toMatch(/crédito/);
  });

  it('una puja válida llega a toda la sala con el precio y el mínimo nuevos', async () => {
    winningAmount = st.lot.minNextBid;
    user.emit('bid:place', { lotId: lot1.id, amount: winningAmount });

    const newBid = await spectator.waitFor('bid:new');
    expect(newBid.currentPrice).toBe(winningAmount);
    expect(newBid.minNextBid).toBe(winningAmount + st.lot.bidIncrement);

    const offerMsg = await spectator.waitFor('chat:message', (m) => m.isOffer);
    expect(offerMsg.text).toMatch(/ofreció/);
  });

  it('el chat llega al resto de la sala', async () => {
    user.emit('chat:message', { auctionId, text: 'hola sala' });
    await expect(spectator.waitFor('chat:message', (m) => m.text === 'hola sala')).resolves.toBeTruthy();
  });

  it('el espectador no puede chatear', async () => {
    spectator.emit('chat:message', { auctionId, text: 'yo no puedo' });
    expect((await spectator.waitFor('chat:error')).message).toMatch(/iniciar sesión/);
  });
});

describe('Martillero: lote actual', () => {
  it('un usuario común no puede cambiar el lote en remate', async () => {
    const res = await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lot2.id }, U);
    expect(res.status).toBe(403);
  });

  it('el martillero pasa al lote 2 y la sala recibe lot:change', async () => {
    const res = await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lot2.id }, A);
    expect(res.status).toBe(200);
    const ch = await spectator.waitFor('lot:change', (s) => s.lot?.id === lot2.id);
    expect(ch.lot.id).toBe(lot2.id);
  });

  it('no se puede pujar a un lote que no está en remate', async () => {
    user.emit('bid:place', { lotId: lot1.id, amount: winningAmount + 100_000 });
    expect((await user.waitFor('bid:error')).message).toMatch(/no está en remate/);
  });
});

describe('Cierre de lote', () => {
  it('cerrar el lote 1 lo adjudica al que va ganando y la sala avanza sola al lote 2', async () => {
    await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lot1.id }, A);
    await spectator.waitFor('lot:change', (s) => s.lot?.id === lot1.id);

    const close = await app.api('POST', `/compras/cerrar-lote/${lot1.id}`, null, A);
    expect(close.status).toBe(201);

    const sold = await spectator.waitFor('lot:sold');
    expect(sold.lotId).toBe(lot1.id);
    expect(sold.amount).toBe(winningAmount);

    const next = await spectator.waitFor('lot:change', (s) => s.lot?.id === lot2.id);
    expect(next.lot.id).toBe(lot2.id);
  });

  it('la compra aparece en /compras/mias del ganador', async () => {
    const mias = await app.api('GET', '/compras/mias', null, U);
    expect(mias.data.purchases).toHaveLength(1);
    expect(mias.data.purchases[0].lot.title).toBe(lot1.title);
  });

  it('quien entra tarde ve el lote actual', async () => {
    const late = app.room({ pase });
    late.emit('auction:join', { auctionId });
    expect((await late.waitFor('auction:state')).lot?.id).toBe(lot2.id);
  });

  it('una subasta inexistente responde auction:error', async () => {
    user.emit('auction:join', { auctionId: '00000000-0000-0000-0000-000000000000' });
    expect((await user.waitFor('auction:error')).message).toMatch(/no encontrad/i);
  });
});

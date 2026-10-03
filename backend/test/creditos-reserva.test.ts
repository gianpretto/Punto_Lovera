import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearPostor, startTestApp, type TestApp } from './helpers/app';

// Reserva de crédito: al ir ganando se reserva el monto de la puja, al ser
// superado se libera, al adjudicar se descuenta del saldo y al finalizar la
// subasta se libera lo que quedó sin adjudicar.

let app: TestApp;
let A: string;
let U1: string; // usuario del seed, saldo 500.000
let U2: string; // segundo postor, saldo 1.000.000
let auctionId: string;
let lot1: { id: string };
let lot2: { id: string };

const me = async (token: string) => (await app.api('GET', '/auth/me', null, token)).data.user;
const bid = (lotId: string, amount: number, token: string) =>
  app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/pujas`, { amount }, token);
const loteActual = (lotId: string) => app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId }, A);

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U1 = await app.login('usuario@test.com', 'user1234');
  U2 = await crearPostor(app, 'postor2@test.com', 'postor1234', 1_000_000);

  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  [lot1, lot2] = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots;
  await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
});
afterAll(async () => {
  await app?.close();
});

describe('Reserva de crédito mientras se va ganando', () => {
  it('U1 arranca con 500.000 disponibles y nada reservado', async () => {
    const u1 = await me(U1);
    expect(u1).toMatchObject({ creditBalance: 500000, heldCredit: 0, availableCredit: 500000 });
  });

  it('ir ganando un lote reserva el monto de la puja', async () => {
    expect((await bid(lot1.id, 300000, U1)).status).toBe(201);
    expect(await me(U1)).toMatchObject({ heldCredit: 300000, availableCredit: 200000 });
  });

  it('en otro lote solo se puede usar lo disponible', async () => {
    await loteActual(lot2.id);
    const over = await bid(lot2.id, 250000, U1);
    expect(over.status).toBe(400);
    expect(over.data.error).toMatch(/reservados/);
    expect((await bid(lot2.id, 100000, U1)).status).toBe(201);
  });

  it('subir la propia puja reemplaza la reserva de ese lote (no suma)', async () => {
    expect((await bid(lot2.id, 200000, U1)).status).toBe(201);
    expect(await me(U1)).toMatchObject({ heldCredit: 500000, availableCredit: 0 });
    // y no puede pasarse de su saldo total
    expect((await bid(lot2.id, 205000, U1)).status).toBe(400);
  });

  it('ser superado libera la reserva', async () => {
    await loteActual(lot1.id);
    expect((await bid(lot1.id, 310000, U2)).status).toBe(201);
    expect(await me(U1)).toMatchObject({ heldCredit: 200000, availableCredit: 300000 });
    const u2 = await me(U2);
    expect(u2).toMatchObject({ heldCredit: 310000, availableCredit: 690000 });

    const lot = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots.find(
      (l: { id: string }) => l.id === lot1.id
    );
    expect(lot.leaderId).toBe(u2.id);
  });

  it('adjudicar descuenta el monto del saldo del ganador', async () => {
    expect((await app.api('POST', `/compras/cerrar-lote/${lot1.id}`, null, A)).status).toBe(201);
    expect(await me(U2)).toMatchObject({ creditBalance: 690000, heldCredit: 0, availableCredit: 690000 });
    // U1 no pierde saldo: sigue reservando lo del lote 2
    expect(await me(U1)).toMatchObject({ creditBalance: 500000, heldCredit: 200000 });
  });

  it('finalizar la subasta libera la reserva de los lotes sin adjudicar', async () => {
    await app.api('PATCH', `/subastas/${auctionId}`, { status: 'FINALIZADA' }, A);
    expect(await me(U1)).toMatchObject({ heldCredit: 0, availableCredit: 500000 });
  });
});

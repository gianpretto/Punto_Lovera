import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearPostor, startTestApp, type TestApp } from './helpers/app';

// Pujas simultáneas de dos usuarios sobre el mismo lote.
//
// OJO: PGlite ejecuta las consultas de a una (tiene una sola conexión real
// por detrás y encola las de todos los clientes), así que acá la carrera
// entre dos UPDATE concurrentes NO se reproduce de verdad: el control de
// concurrencia optimista de bid.service.ts (reintento sobre UPDATE
// condicional) solo se ejercita contra un Postgres real. Este test queda como
// prueba de CONSISTENCIA: después de una ráfaga de pujas en paralelo, el
// precio, el líder, las filas de bids y las reservas de crédito cuadran.

let app: TestApp;
let U1: string;
let U2: string;
let auctionId: string;
let lotId: string;

beforeAll(async () => {
  app = await startTestApp();
  const A = await app.login('admin@puntolovera.com', 'admin1234');
  U1 = await app.login('usuario@test.com', 'user1234');
  U2 = await crearPostor(app, 'postor2@test.com', 'postor1234', 1_000_000);

  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  lotId = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots[0].id;
  await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
});
afterAll(async () => {
  await app?.close();
});

describe('Pujas simultáneas (consistencia)', () => {
  let results: { status: number; amount: number }[];

  it('20 pujas a la vez (10 de cada usuario) no terminan en error 500', async () => {
    // Montos crecientes y todos válidos de entrada (precio base 150.000, incremento 5.000)
    results = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const amount = 160000 + i * 5000;
        const res = await app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/pujas`, { amount }, i % 2 ? U2 : U1);
        return { status: res.status, amount };
      })
    );
    for (const r of results) expect([201, 400, 409]).toContain(r.status);
    expect(results.some((r) => r.status === 201)).toBe(true);
  });

  it('las pujas guardadas son las aceptadas y quedan estrictamente crecientes', async () => {
    const accepted = results.filter((r) => r.status === 201);
    const rows = await app.sql<{ amount: string }>('SELECT amount FROM bids WHERE lot_id = $1 ORDER BY amount', [lotId]);
    expect(rows).toHaveLength(accepted.length);
    // Sin dos pujas aceptadas con el mismo monto (ninguna se basó en un precio viejo)
    const amounts = rows.map((b) => Number(b.amount));
    expect(new Set(amounts).size).toBe(amounts.length);
    expect(amounts.sort((a, b) => a - b)).toEqual(accepted.map((r) => r.amount).sort((a, b) => a - b));
  });

  it('el precio y el líder del lote corresponden a la puja más alta', async () => {
    const [lot] = await app.sql<{ current_price: string; leader_id: string }>(
      'SELECT current_price, leader_id FROM lots WHERE id = $1',
      [lotId]
    );
    const [top] = await app.sql<{ user_id: string; amount: string }>(
      'SELECT user_id, amount FROM bids WHERE lot_id = $1 ORDER BY amount DESC LIMIT 1',
      [lotId]
    );
    expect(Number(lot.current_price)).toBe(Number(top.amount));
    expect(lot.leader_id).toBe(top.user_id);
  });

  it('solo el líder tiene crédito reservado, por el precio actual', async () => {
    const [lot] = await app.sql<{ current_price: string }>('SELECT current_price FROM lots WHERE id = $1', [lotId]);
    const me1 = (await app.api('GET', '/auth/me', null, U1)).data.user;
    const me2 = (await app.api('GET', '/auth/me', null, U2)).data.user;
    expect(me1.heldCredit + me2.heldCredit).toBe(Number(lot.current_price));
    expect(me1.heldCredit === 0 || me2.heldCredit === 0).toBe(true);
  });
});

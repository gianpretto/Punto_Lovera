import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Catálogo de bienes paginado: GET /subastas/:id/lotes y GET /subastas/:id?lots=false
let app: TestApp;
let auctionId: string;

beforeAll(async () => {
  app = await startTestApp();
  auctionId = crypto.randomUUID();
  await app.sql(
    `INSERT INTO auctions (id, title, description, location, starts_at, status)
     VALUES ($1, 'Catálogo grande', 'desc', 'Morón', now() + interval '1 day', 'PROXIMA')`,
    [auctionId]
  );
  // 8 lotes cargados desordenados; el 3 con dos fotos (posición 1 y 0)
  for (const n of [5, 1, 8, 3, 2, 7, 4, 6]) {
    const lotId = crypto.randomUUID();
    await app.sql(
      `INSERT INTO lots (id, auction_id, number, title, description, starting_price, current_price)
       VALUES ($1, $2, $3, $4, 'desc', 1000, 1000)`,
      [lotId, auctionId, n, `Lote ${n}`]
    );
    if (n === 3) {
      await app.sql(`INSERT INTO lot_images (id, lot_id, url, position) VALUES ($1, $2, '/b.jpg', 1)`, [crypto.randomUUID(), lotId]);
      await app.sql(`INSERT INTO lot_images (id, lot_id, url, position) VALUES ($1, $2, '/a.jpg', 0)`, [crypto.randomUUID(), lotId]);
    }
  }
});
afterAll(async () => {
  await app?.close();
});

describe('Catálogo paginado', () => {
  it('devuelve los lotes por número, 6 por página por defecto, con fotos ordenadas', async () => {
    const p1 = await app.api('GET', `/subastas/${auctionId}/lotes`);
    expect(p1.status).toBe(200);
    expect(p1.data.lots.map((l: { number: number }) => l.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p1.data).toMatchObject({ total: 8, page: 1, pageSize: 6, pages: 2 });
    const lote3 = p1.data.lots.find((l: { number: number }) => l.number === 3);
    expect(lote3.images.map((i: { url: string }) => i.url)).toEqual(['/a.jpg', '/b.jpg']);

    const p2 = await app.api('GET', `/subastas/${auctionId}/lotes?page=2`);
    expect(p2.data.lots.map((l: { number: number }) => l.number)).toEqual([7, 8]);
  });

  it('la ficha sin lotes trae la cantidad', async () => {
    const res = await app.api('GET', `/subastas/${auctionId}?lots=false`);
    expect(res.status).toBe(200);
    expect(res.data.auction.lots).toBeUndefined();
    expect(res.data.auction.lotCount).toBe(8);
    // Sin el parámetro sigue viniendo completa (sala, martillero, admin)
    const completa = await app.api('GET', `/subastas/${auctionId}`);
    expect(completa.data.auction.lots).toHaveLength(8);
  });

  it('valida parámetros y subasta inexistente', async () => {
    expect((await app.api('GET', `/subastas/${auctionId}/lotes?pageSize=100`)).status).toBe(400);
    expect((await app.api('GET', `/subastas/${crypto.randomUUID()}/lotes`)).status).toBe(404);
  });
});

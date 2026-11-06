import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// GET /subastas?status=...&page=N&pageSize=M: paginado en la base, con el
// orden de la web (en vivo → próximas por fecha → terminadas, la más nueva primero)
let app: TestApp;
const DIA = 24 * 3600 * 1000;

beforeAll(async () => {
  app = await startTestApp();
  await app.sql('DELETE FROM auctions');
  const crear = (titulo: string, estado: string, dias: number) =>
    app.sql(
      `INSERT INTO auctions (id, title, description, location, starts_at, status)
       VALUES ($1, $2, 'desc', 'Morón', $3, $4)`,
      [crypto.randomUUID(), titulo, new Date(Date.now() + dias * DIA).toISOString().slice(0, 23), estado]
    );
  await crear('Próxima lejana', 'PROXIMA', 20);
  await crear('Terminada vieja', 'FINALIZADA', -30);
  await crear('En vivo', 'ACTIVA', 0);
  await crear('Próxima cercana', 'PROXIMA', 2);
  await crear('Terminada reciente', 'FINALIZADA', -3);
  await crear('Próxima media', 'PROXIMA', 10);
  await crear('Cancelada', 'CANCELADA', 5);
});
afterAll(async () => {
  await app?.close();
});

const titulos = (r: { data: { auctions: { title: string }[] } }) => r.data.auctions.map((a) => a.title);

describe('GET /subastas paginado', () => {
  it('devuelve la página pedida con el orden de la web y el total', async () => {
    const p1 = await app.api('GET', '/subastas?status=ACTIVA,PROXIMA,FINALIZADA&page=1&pageSize=4');
    expect(p1.status).toBe(200);
    expect(titulos(p1)).toEqual(['En vivo', 'Próxima cercana', 'Próxima media', 'Próxima lejana']);
    expect(p1.data).toMatchObject({ total: 6, page: 1, pageSize: 4, pages: 2 });

    const p2 = await app.api('GET', '/subastas?status=ACTIVA,PROXIMA,FINALIZADA&page=2&pageSize=4');
    expect(titulos(p2)).toEqual(['Terminada reciente', 'Terminada vieja']);
  });

  it('usa 6 por página por defecto y filtra por estado', async () => {
    const r = await app.api('GET', '/subastas?status=FINALIZADA&page=1');
    expect(r.data.pageSize).toBe(6);
    expect(titulos(r)).toEqual(['Terminada reciente', 'Terminada vieja']);
  });

  it('una página vacía más allá del final no falla', async () => {
    const r = await app.api('GET', '/subastas?page=9&pageSize=6');
    expect(r.status).toBe(200);
    expect(r.data.auctions).toEqual([]);
    expect(r.data.total).toBe(7);
  });

  it('valida los parámetros', async () => {
    expect((await app.api('GET', '/subastas?status=HOLA&page=1')).status).toBe(400);
    expect((await app.api('GET', '/subastas?page=1&pageSize=500')).status).toBe(400);
    expect((await app.api('GET', '/subastas?page=0')).status).toBe(400);
  });

  it('sin page sigue devolviendo la lista completa (admin)', async () => {
    const r = await app.api('GET', '/subastas');
    expect(r.data.auctions).toHaveLength(7);
    expect(r.data.total).toBeUndefined();
  });
});

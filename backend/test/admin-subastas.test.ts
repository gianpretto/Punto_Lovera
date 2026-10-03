import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formConArchivos, PNG, startTestApp, type TestApp } from './helpers/app';

// Administración de subastas y lotes (martillero/admin): crear, portada,
// lotes, fotos, y las reglas de precio base y borrado cuando ya hay ofertas.

let app: TestApp;
let A: string;
let U: string;
let auctionId: string;

const png = (name = 'foto.png') => ({ data: PNG, type: 'image/png', name });
const txt = { data: Buffer.from('hola'), type: 'text/plain', name: 'nota.txt' };
const publico = (url: string) => fetch(app.baseUrl + url).then((r) => r.status);
const nuevaSubasta = (token: string, extra: Record<string, unknown> = {}) =>
  app.api(
    'POST',
    '/subastas',
    {
      title: 'Remate de panadería en Morón',
      description: 'Hornos, amasadora y mostradores',
      location: 'Morón, Buenos Aires',
      startsAt: new Date(Date.now() + 7 * 864e5).toISOString(),
      ...extra,
    },
    token
  );

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');
});
afterAll(async () => {
  await app?.close();
});

describe('Crear subasta y portada', () => {
  let cover1: string;

  it('un usuario común no puede crear subastas (403)', async () => {
    expect((await nuevaSubasta(U)).status).toBe(403);
  });

  it('valida los campos obligatorios', async () => {
    expect((await nuevaSubasta(A, { title: '' })).status).toBe(400);
    expect((await nuevaSubasta(A, { coverImageUrl: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('el admin crea la subasta como PROXIMA', async () => {
    const res = await nuevaSubasta(A);
    expect(res.status).toBe(201);
    expect(res.data.auction.status).toBe('PROXIMA');
    auctionId = res.data.auction.id;
  });

  it('sube la portada: queda pública en /uploads/lots', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/portada`, formConArchivos('image', [png()]), A);
    expect(res.status).toBe(201);
    cover1 = res.data.auction.coverImageUrl;
    expect(cover1).toMatch(/^\/uploads\/lots\/[\w.-]+\.png$/);
    expect(await publico(cover1)).toBe(200);
  });

  it('la portada solo acepta imágenes y solo la sube martillero/admin', async () => {
    const bad = await app.api('POST', `/subastas/${auctionId}/portada`, formConArchivos('image', [txt]), A);
    expect(bad.status).toBe(400);
    expect(bad.data.error).toMatch(/Solo se permiten imágenes/);
    expect((await app.api('POST', `/subastas/${auctionId}/portada`, formConArchivos('image', [png()]), U)).status).toBe(403);
  });

  it('cambiar la portada borra la imagen anterior', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/portada`, formConArchivos('image', [png()]), A);
    expect(res.data.auction.coverImageUrl).not.toBe(cover1);
    expect(await publico(cover1)).toBe(404);
  });
});

describe('Lotes y fotos', () => {
  let lotId: string;
  let images: { id: string; url: string }[];

  it('crea un lote con el precio actual igual al precio base', async () => {
    const res = await app.api(
      'POST',
      `/subastas/${auctionId}/lotes`,
      { number: 1, title: 'Horno rotativo', description: 'A gas, 18 bandejas', startingPrice: 200000, bidIncrement: 10000 },
      A
    );
    expect(res.status).toBe(201);
    expect(Number(res.data.lot.currentPrice)).toBe(200000);
    lotId = res.data.lot.id;
  });

  it('no permite repetir el número de lote ni crear lotes a un usuario común', async () => {
    const lote = { number: 1, title: 'Otro', description: 'd', startingPrice: 1000 };
    const dup = await app.api('POST', `/subastas/${auctionId}/lotes`, lote, A);
    expect(dup.status).toBe(400);
    expect(dup.data.error).toMatch(/Ya existe el lote número 1/);
    expect((await app.api('POST', `/subastas/${auctionId}/lotes`, { ...lote, number: 2 }, U)).status).toBe(403);
  });

  it('sube varias fotos y quedan públicas en orden', async () => {
    const form = formConArchivos('images', [png('a.png'), png('b.png')]);
    const res = await app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/imagenes`, form, A);
    expect(res.status).toBe(201);
    images = res.data.lot.images;
    expect(images).toHaveLength(2);
    for (const img of images) expect(await publico(img.url)).toBe(200);
  });

  it('una foto que no es imagen → 400', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/imagenes`, formConArchivos('images', [txt]), A);
    expect(res.status).toBe(400);
  });

  it('borrar una foto la saca del lote y del disco', async () => {
    const res = await app.api('DELETE', `/subastas/${auctionId}/lotes/${lotId}/imagenes/${images[0].id}`, null, A);
    expect(res.status).toBe(200);
    expect(res.data.lot.images.map((i: { id: string }) => i.id)).toEqual([images[1].id]);
    expect(await publico(images[0].url)).toBe(404);
    // ya borrada → 404
    expect((await app.api('DELETE', `/subastas/${auctionId}/lotes/${lotId}/imagenes/${images[0].id}`, null, A)).status).toBe(404);
  });

  it('un lote no se puede tocar desde la URL de otra subasta', async () => {
    const otra = (await app.api('GET', '/subastas')).data.auctions.find((a: { id: string }) => a.id !== auctionId).id;
    expect((await app.api('PATCH', `/subastas/${otra}/lotes/${lotId}`, { title: 'x' }, A)).status).toBe(404);
    expect((await app.api('DELETE', `/subastas/${otra}/lotes/${lotId}`, null, A)).status).toBe(404);
  });

  it('sin ofertas, cambiar el precio base mueve también el precio actual', async () => {
    const res = await app.api('PATCH', `/subastas/${auctionId}/lotes/${lotId}`, { startingPrice: 180000 }, A);
    expect(res.status).toBe(200);
    expect(Number(res.data.lot.startingPrice)).toBe(180000);
    expect(Number(res.data.lot.currentPrice)).toBe(180000);
  });
});

describe('Reglas cuando ya hay ofertas', () => {
  let conOferta: string;
  let sinOferta: string;

  beforeAll(async () => {
    const lots = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots;
    conOferta = lots[0].id;
    sinOferta = (
      await app.api('POST', `/subastas/${auctionId}/lotes`, { number: 2, title: 'Amasadora', description: 'd', startingPrice: 50000 }, A)
    ).data.lot.id;
    await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
    await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: conOferta }, A);
    const puja = await app.api('POST', `/subastas/${auctionId}/lotes/${conOferta}/pujas`, { amount: 190000 }, U);
    expect(puja.status).toBe(201);
  });

  it('no se puede cambiar el precio base de un lote con ofertas (otros campos sí)', async () => {
    const res = await app.api('PATCH', `/subastas/${auctionId}/lotes/${conOferta}`, { startingPrice: 100000 }, A);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/ya recibió ofertas/);
    const ok = await app.api('PATCH', `/subastas/${auctionId}/lotes/${conOferta}`, { title: 'Horno rotativo Argental' }, A);
    expect(ok.status).toBe(200);
    expect(Number(ok.data.lot.currentPrice)).toBe(190000);
  });

  it('no se puede borrar un lote con ofertas, uno sin ofertas sí', async () => {
    expect((await app.api('DELETE', `/subastas/${auctionId}/lotes/${conOferta}`, null, A)).status).toBe(400);
    expect((await app.api('DELETE', `/subastas/${auctionId}/lotes/${sinOferta}`, null, U)).status).toBe(403);
    expect((await app.api('DELETE', `/subastas/${auctionId}/lotes/${sinOferta}`, null, A)).status).toBe(204);
  });

  it('no se puede borrar una subasta con ofertas (se cancela)', async () => {
    const res = await app.api('DELETE', `/subastas/${auctionId}`, null, A);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/cancelada/);
  });

  it('una subasta sin ofertas se borra junto con sus archivos', async () => {
    const id = (await nuevaSubasta(A)).data.auction.id;
    const cover = (await app.api('POST', `/subastas/${id}/portada`, formConArchivos('image', [png()]), A)).data.auction
      .coverImageUrl;
    expect((await app.api('DELETE', `/subastas/${id}`, null, U)).status).toBe(403);
    expect((await app.api('DELETE', `/subastas/${id}`, null, A)).status).toBe(204);
    expect((await app.api('GET', `/subastas/${id}`)).status).toBe(404);
    expect(await publico(cover)).toBe(404);
  });
});

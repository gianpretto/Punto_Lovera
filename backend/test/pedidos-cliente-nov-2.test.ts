import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearPostor, startTestApp, type TestApp } from './helpers/app';

// Segunda reunión con el cliente (nov 2026): subastas ocultas hasta
// publicarlas, base oculta ("sin base"), lotes "bis", lote anterior,
// apertura al llegar la hora, privados con el martillero, martillero
// destacado en el chat, base de personas y favoritos.

let app: TestApp;
let A: string;
let U1: string;
let U2: string;

const crearSubasta = async (extra: Record<string, unknown> = {}) =>
  (
    await app.api(
      'POST',
      '/subastas',
      { title: 'Remate QA', description: 'd', location: 'Morón', startsAt: new Date(Date.now() + 86_400_000).toISOString(), ...extra },
      A
    )
  ).data.auction;
const crearLote = (auctionId: string, number: number, extra: Record<string, unknown> = {}) =>
  app.api('POST', `/subastas/${auctionId}/lotes`, { number, title: `Lote ${number}`, description: 'x', startingPrice: 100000, bidIncrement: 10000, ...extra }, A);

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U1 = await app.login('usuario@test.com', 'user1234');
  U2 = await crearPostor(app, 'postor2@test.com', 'postor1234', 1_000_000);
});
afterAll(async () => {
  await app?.close();
});

describe('Subasta oculta hasta publicarla', () => {
  let id: string;
  beforeAll(async () => {
    id = (await crearSubasta()).id;
    await crearLote(id, 1);
  });

  it('se crea oculta: el público no la ve, el admin sí (con ?ocultas=1)', async () => {
    const publico = (await app.api('GET', '/subastas')).data.auctions.map((a: { id: string }) => a.id);
    expect(publico).not.toContain(id);
    expect((await app.api('GET', `/subastas/${id}`)).status).toBe(404);
    expect((await app.api('GET', `/subastas/${id}/lotes`, null, U1)).status).toBe(404);
    expect((await app.api('GET', `/subastas/${id}`, null, A)).data.auction.published).toBe(false);
    const admin = (await app.api('GET', '/subastas?ocultas=1', null, A)).data.auctions.map((a: { id: string }) => a.id);
    expect(admin).toContain(id);
    // ?ocultas=1 sin ser staff no cambia nada
    const truco = (await app.api('GET', '/subastas?ocultas=1', null, U1)).data.auctions.map((a: { id: string }) => a.id);
    expect(truco).not.toContain(id);
  });

  it('a la sala de una oculta no entra el público', async () => {
    const sala = app.room({ token: U1 });
    sala.emit('auction:join', { auctionId: id });
    expect((await sala.waitFor('auction:error')).message).toMatch(/No encontramos/);
  });

  it('al publicarla aparece', async () => {
    expect((await app.api('PATCH', `/subastas/${id}`, { published: true }, A)).status).toBe(200);
    expect((await app.api('GET', `/subastas/${id}`)).status).toBe(200);
  });
});

describe('Precio base interno ("sin base")', () => {
  it('el público no ve la base ni el precio hasta la primera oferta; el admin sí', async () => {
    const { id } = await crearSubasta({ published: true });
    const lote = (await crearLote(id, 1, { startingPrice: 250000 })).data.lot;
    const pub = (await app.api('GET', `/subastas/${id}`)).data.auction.lots[0];
    expect(pub).not.toHaveProperty('startingPrice');
    expect(pub.currentPrice).toBeNull();
    expect((await app.api('GET', `/subastas/${id}/lotes`)).data.lots[0].currentPrice).toBeNull();
    expect((await app.api('GET', `/subastas/${id}/lotes/${lote.id}`)).data.lot).not.toHaveProperty('startingPrice');
    expect(Number((await app.api('GET', `/subastas/${id}`, null, A)).data.auction.lots[0].startingPrice)).toBe(250000);

    // La primera oferta mínima es la base
    await app.api('PATCH', `/subastas/${id}`, { status: 'ACTIVA' }, A);
    expect((await app.api('POST', `/subastas/${id}/lotes/${lote.id}/pujas`, { amount: 249999 }, U2)).status).toBe(400);
    expect((await app.api('POST', `/subastas/${id}/lotes/${lote.id}/pujas`, { amount: 250000 }, U2)).status).toBe(201);
    // Con ofertas el precio ya es público (la base no)
    const despues = (await app.api('GET', `/subastas/${id}`)).data.auction.lots[0];
    expect(Number(despues.currentPrice)).toBe(250000);
    expect(despues).not.toHaveProperty('startingPrice');
    await app.api('PATCH', `/subastas/${id}`, { status: 'FINALIZADA' }, A);
  });
});

describe('Lotes "bis"', () => {
  let id: string;
  beforeAll(async () => {
    id = (await crearSubasta({ published: true })).id;
    for (const n of [1, 2, 3]) await crearLote(id, n);
  });

  it('se puede agregar un solo bis por número, y solo si existe el número', async () => {
    expect((await crearLote(id, 1, { bis: true })).status).toBe(201);
    const otro = await crearLote(id, 1, { bis: true });
    expect(otro.status).toBe(400);
    expect(otro.data.error).toMatch(/ya tiene un bis/);
    const huerfano = await crearLote(id, 9, { bis: true });
    expect(huerfano.data.error).toMatch(/primero tiene que existir el lote 9/);
  });

  it('el catálogo los ordena con el bis después de su número', async () => {
    const lotes = (await app.api('GET', `/subastas/${id}/lotes?pageSize=10`)).data.lots;
    expect(lotes.map((l: { number: number; bis: boolean }) => `${l.number}${l.bis ? 'b' : ''}`)).toEqual(['1', '1b', '2', '3']);
  });

  it('no se borra un lote que tiene bis', async () => {
    const lotes = (await app.api('GET', `/subastas/${id}`, null, A)).data.auction.lots;
    const uno = lotes.find((l: { number: number; bis: boolean }) => l.number === 1 && !l.bis);
    expect((await app.api('DELETE', `/subastas/${id}/lotes/${uno.id}`, null, A)).data.error).toMatch(/tiene un bis/);
  });

  it('siguiente y anterior lote recorren el orden con el bis', async () => {
    await app.api('PATCH', `/subastas/${id}`, { status: 'ACTIVA' }, A);
    const paso = async (ruta: string) => {
      const res = await app.api('POST', `/subastas/${id}/${ruta}`, null, A);
      return res.status === 200 ? `${res.data.lot.number}${res.data.lot.bis ? 'b' : ''}` : res.data.error;
    };
    expect(await paso('siguiente-lote')).toBe('1b');
    expect(await paso('siguiente-lote')).toBe('2');
    expect(await paso('lote-anterior')).toBe('1b');
    expect(await paso('lote-anterior')).toBe('1');
    expect(await paso('lote-anterior')).toMatch(/primer lote/);
    expect((await app.api('POST', `/subastas/${id}/lote-anterior`, null, U1)).status).toBe(403);
    await app.api('PATCH', `/subastas/${id}`, { status: 'FINALIZADA' }, A);
  });
});

describe('Apertura al llegar la hora', () => {
  it('pasa a ACTIVA solo si está publicada y el horario pasó hace menos de 12 h', async () => {
    const { abrirSubastasEnHorario } = await import('../src/services/apertura.service');
    const recien = await crearSubasta({ published: true });
    const oculta = await crearSubasta();
    const vieja = await crearSubasta({ published: true });
    const futura = await crearSubasta({ published: true });
    await app.sql("UPDATE auctions SET starts_at = now() - interval '1 minute' WHERE id = ANY($1)", [[recien.id, oculta.id]]);
    await app.sql("UPDATE auctions SET starts_at = now() - interval '2 days' WHERE id = $1", [vieja.id]);

    const sala = app.room({ token: U1 });
    sala.emit('auction:join', { auctionId: recien.id });
    await sala.waitFor('auction:state');

    const abiertas = await abrirSubastasEnHorario();
    expect(abiertas).toContain(recien.id);
    expect(abiertas).not.toContain(oculta.id);
    expect(abiertas).not.toContain(vieja.id);
    expect(abiertas).not.toContain(futura.id);
    expect((await sala.waitFor('lot:change')).auction.status).toBe('ACTIVA');
    await app.sql("UPDATE auctions SET status = 'FINALIZADA' WHERE id = $1", [recien.id]);
  });
});

describe('Chat: privados con el martillero y martillero destacado', () => {
  let id: string;
  let idU1: string;
  beforeAll(async () => {
    id = (await crearSubasta({ published: true })).id;
    await crearLote(id, 1);
    await app.api('PATCH', `/subastas/${id}`, { status: 'ACTIVA' }, A);
    idU1 = (await app.api('GET', '/auth/me', null, U1)).data.user.id;
  });

  it('el privado lo ven el usuario y el martillero, no el resto; el martillero contesta', async () => {
    const [u1, u2, mart] = [app.room({ token: U1 }), app.room({ token: U2 }), app.room({ token: A })];
    for (const s of [u1, u2, mart]) {
      s.emit('auction:join', { auctionId: id });
      await s.waitFor('auction:state');
    }

    u1.emit('chat:message', { auctionId: id, text: 'consulta privada', privado: true });
    const visto = await mart.waitFor('chat:message', (m) => m.text === 'consulta privada');
    expect(visto).toMatchObject({ privateUserId: idU1, staff: false });
    await u1.waitFor('chat:message', (m) => m.text === 'consulta privada');

    mart.emit('chat:message', { auctionId: id, text: 'respuesta privada', paraUserId: idU1 });
    expect(await u1.waitFor('chat:message', (m) => m.text === 'respuesta privada')).toMatchObject({
      staff: true,
      privateUserId: idU1,
    });

    // Público del martillero: destacado para todos
    mart.emit('chat:message', { auctionId: id, text: 'arrancamos' });
    expect(await u2.waitFor('chat:message', (m) => m.text === 'arrancamos')).toMatchObject({ staff: true, privateUserId: null });
    // U2 no recibió ninguno de los privados
    await expect(u2.waitFor('chat:message', (m) => /privada/.test(m.text), 300)).rejects.toThrow(/Timeout/);

    // Un usuario no puede "contestar en privado" a otro
    u2.emit('chat:message', { auctionId: id, text: 'hola', paraUserId: idU1 });
    expect((await u2.waitFor('chat:error')).message).toMatch(/Solo el martillero/);
  });

  it('el historial respeta los privados; el panel ve todas las conversaciones', async () => {
    const otra = app.room({ token: U2 });
    otra.emit('auction:join', { auctionId: id });
    const hist = await otra.waitFor('chat:history');
    expect(hist.map((m: { text: string }) => m.text)).not.toContain('consulta privada');

    const panel = await app.api('GET', `/subastas/${id}/privados`, null, A);
    expect(panel.data.messages.map((m: { text: string }) => m.text)).toEqual(['consulta privada', 'respuesta privada']);
    expect((await app.api('GET', `/subastas/${id}/privados`, null, U1)).status).toBe(403);

    const desdePanel = await app.api('POST', `/subastas/${id}/privados`, { userId: idU1, text: 'desde el panel' }, A);
    expect(desdePanel.status).toBe(201);
    expect(desdePanel.data.message).toMatchObject({ privateUserId: idU1, staff: true });
  });
});

describe('Base de personas (martillero/admin)', () => {
  it('lista con filtros; un usuario común no accede', async () => {
    expect((await app.api('GET', '/admin/usuarios', null, U1)).status).toBe(403);
    const todos = (await app.api('GET', '/admin/usuarios', null, A)).data;
    expect(todos.total).toBeGreaterThanOrEqual(3);
    expect(todos.users[0]).not.toHaveProperty('passwordHash');
    const porMail = (await app.api('GET', '/admin/usuarios?q=postor2', null, A)).data.users;
    expect(porMail.map((u: { email: string }) => u.email)).toEqual(['postor2@test.com']);
    const porDni = (await app.api('GET', '/admin/usuarios?q=30111222', null, A)).data.users;
    expect(porDni.map((u: { email: string }) => u.email)).toEqual(['usuario@test.com']);
    const admins = (await app.api('GET', '/admin/usuarios?rol=ADMIN', null, A)).data.users;
    expect(admins.every((u: { role: string }) => u.role === 'ADMIN')).toBe(true);
    const completos = (await app.api('GET', '/admin/usuarios?datos=completos', null, A)).data.users;
    expect(completos.map((u: { email: string }) => u.email)).toContain('usuario@test.com');
  });

  it('ficha con compras y ofertas; datos editables con validación', async () => {
    const [{ id }] = await app.sql<{ id: string }>("SELECT id FROM users WHERE email = 'postor2@test.com'");
    const ficha = (await app.api('GET', `/admin/usuarios/${id}`, null, A)).data;
    expect(ficha.user.email).toBe('postor2@test.com');
    expect(ficha.purchases.length).toBeGreaterThanOrEqual(0);
    expect(ficha.offers.length).toBeGreaterThanOrEqual(1);

    expect((await app.api('PATCH', `/admin/usuarios/${id}`, { dni: '12' }, A)).status).toBe(400);
    const ok = await app.api('PATCH', `/admin/usuarios/${id}`, { city: 'Haedo', dni: '30999888' }, A);
    expect(ok.status).toBe(200);
    expect(ok.data.user).toMatchObject({ city: 'Haedo', dni: '30999888' });
  });

  it('el rol solo lo cambia un admin, y no a sí mismo', async () => {
    const [{ id }] = await app.sql<{ id: string }>("SELECT id FROM users WHERE email = 'postor2@test.com'");
    const [{ id: adminId }] = await app.sql<{ id: string }>("SELECT id FROM users WHERE email = 'admin@puntolovera.com'");
    expect((await app.api('PATCH', `/admin/usuarios/${adminId}`, { role: 'USER' }, A)).status).toBe(400);
    await app.api('PATCH', `/admin/usuarios/${id}`, { role: 'MARTILLERO' }, A);
    const M = await app.login('postor2@test.com', 'postor1234');
    // Un martillero no cambia roles ni edita admins
    const [{ id: u1Id }] = await app.sql<{ id: string }>("SELECT id FROM users WHERE email = 'usuario@test.com'");
    expect((await app.api('PATCH', `/admin/usuarios/${u1Id}`, { role: 'ADMIN' }, M)).status).toBe(403);
    expect((await app.api('PATCH', `/admin/usuarios/${adminId}`, { city: 'X' }, M)).status).toBe(403);
    expect((await app.api('PATCH', `/admin/usuarios/${u1Id}`, { city: 'Morón' }, M)).status).toBe(200);
    await app.api('PATCH', `/admin/usuarios/${id}`, { role: 'USER' }, A);
  });
});

describe('Favoritos', () => {
  it('agregar, listar y quitar; solo de subastas publicadas', async () => {
    const pub = await crearSubasta({ published: true });
    const lote = (await crearLote(pub.id, 1)).data.lot;
    const oculta = await crearSubasta();
    const loteOculto = (await crearLote(oculta.id, 1)).data.lot;

    expect((await app.api('POST', `/favoritos/${lote.id}`, null, U1)).status).toBe(201);
    expect((await app.api('POST', `/favoritos/${lote.id}`, null, U1)).status).toBe(201); // dos veces no duplica
    expect((await app.api('POST', `/favoritos/${loteOculto.id}`, null, U1)).status).toBe(404);
    expect((await app.api('POST', `/favoritos/${lote.id}`)).status).toBe(401);

    expect((await app.api('GET', '/favoritos/ids', null, U1)).data.lotIds).toEqual([lote.id]);
    const lista = (await app.api('GET', '/favoritos', null, U1)).data.lots;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: lote.id, auction: { id: pub.id } });
    expect(lista[0]).not.toHaveProperty('startingPrice');
    // Los de otro usuario no se ven
    expect((await app.api('GET', '/favoritos', null, U2)).data.lots).toHaveLength(0);

    expect((await app.api('DELETE', `/favoritos/${lote.id}`, null, U1)).status).toBe(200);
    expect((await app.api('GET', '/favoritos/ids', null, U1)).data.lotIds).toEqual([]);
  });
});

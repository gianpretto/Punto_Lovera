import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATOS_COMPLETOS, startTestApp, tokenDeVerificacion, type TestApp } from './helpers/app';

// Pases de invitado (link para mirar sin cuenta), reglas para ingresar al
// remate y requisitos para pujar (datos completos + crédito).

let app: TestApp;
let A: string;
let U: string;
let auctionId: string;
let otraId: string; // otra subasta, para probar que el pase no sirve ahí
let lot: { id: string };
let pass: { id: string; token: string; link: string };

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');
  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
  lot = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots[0];
  const otra = await app.api(
    'POST',
    '/subastas',
    { title: 'Otra', description: 'd', location: 'l', startsAt: new Date(Date.now() + 864e5).toISOString() },
    A
  );
  otraId = otra.data.auction.id;
});
afterAll(async () => {
  await app?.close();
});

describe('Crear y validar pases', () => {
  it('un usuario común no puede crear pases', async () => {
    expect((await app.api('POST', `/subastas/${auctionId}/pases`, { label: 'x', hours: 2 }, U)).status).toBe(403);
  });

  it('el martillero crea un pase con link a la sala', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/pases`, { label: 'Dueño del local', hours: 24 }, A);
    expect(res.status).toBe(201);
    expect(res.data.pass.link).toContain(`/subastas/${auctionId}/activa?pase=`);
    pass = res.data.pass;
  });

  it('aparece en la lista de pases vigentes', async () => {
    const res = await app.api('GET', `/subastas/${auctionId}/pases`, null, A);
    expect(res.data.passes.some((p: { id: string }) => p.id === pass.id)).toBe(true);
  });

  it('validar el pase es público (200) y uno inexistente da 404', async () => {
    expect((await app.api('GET', `/subastas/${auctionId}/pases/${pass.token}/validar`)).status).toBe(200);
    expect((await app.api('GET', `/subastas/${auctionId}/pases/noexiste/validar`)).status).toBe(404);
  });
});

describe('Ingresar a la sala', () => {
  let guest: ReturnType<TestApp['room']>;
  let minNextBid: number;

  it('sin sesión ni pase no se entra', async () => {
    const anon = app.room({});
    anon.emit('auction:join', { auctionId });
    expect((await anon.waitFor('auction:error')).code).toBe('AUTH_REQUIRED');
  });

  it('con pase se entra y se ve el lote en remate', async () => {
    guest = app.room({ pase: pass.token });
    guest.emit('auction:join', { auctionId });
    const st = await guest.waitFor('auction:state');
    expect(st.lot?.id).toBe(lot.id);
    minNextBid = st.lot.minNextBid;
    await guest.waitFor('chat:history');
  });

  it('con pase NO se puede pujar ni escribir en el chat', async () => {
    guest.emit('bid:place', { lotId: lot.id, amount: 999999 });
    expect((await guest.waitFor('bid:error')).message).toMatch(/iniciar sesión/);
    guest.emit('chat:message', { auctionId, text: 'hola' });
    expect((await guest.waitFor('chat:error')).message).toMatch(/iniciar sesión/);
  });

  it('el pase no sirve para otra subasta', async () => {
    const wrong = app.room({ pase: pass.token });
    wrong.emit('auction:join', { auctionId: otraId });
    expect((await wrong.waitFor('auction:error')).code).toBe('AUTH_REQUIRED');
  });

  it('el invitado ve las pujas en tiempo real', async () => {
    const user = app.room({ token: U });
    user.emit('auction:join', { auctionId });
    await user.waitFor('auction:state');
    user.emit('bid:place', { lotId: lot.id, amount: minNextBid });
    expect((await guest.waitFor('bid:new')).currentPrice).toBe(minNextBid);
  });
});

describe('Video en vivo: JWT o pase', () => {
  const playlist = (id: string) => `/subastas/${id}/vivo/hls/index.m3u8`;

  it('sin sesión ni pase → 401', async () => {
    expect((await app.api('GET', playlist(auctionId))).status).toBe(401);
  });

  it('con pase pasa la autorización (404 = la subasta no tiene cámara)', async () => {
    const res = await app.api('GET', playlist(auctionId), null, null, { 'X-Pase': pass.token });
    expect(res.status).toBe(404);
  });

  it('un pase de otra subasta no ve el video', async () => {
    expect((await app.api('GET', playlist(otraId), null, null, { 'X-Pase': pass.token })).status).toBe(401);
  });
});

describe('Pases revocados o vencidos', () => {
  it('el martillero revoca el pase y ya no entra', async () => {
    expect((await app.api('DELETE', `/subastas/${auctionId}/pases/${pass.id}`, null, A)).status).toBe(204);
    const revoked = app.room({ pase: pass.token });
    revoked.emit('auction:join', { auctionId });
    expect((await revoked.waitFor('auction:error')).code).toBe('AUTH_REQUIRED');
  });

  it('un pase vencido ya no entra', async () => {
    const exp = (await app.api('POST', `/subastas/${auctionId}/pases`, { label: 'vence', hours: 1 }, A)).data.pass;
    await app.sql(`UPDATE auction_passes SET expires_at = now() - interval '1 minute' WHERE id = $1`, [exp.id]);
    const expired = app.room({ pase: exp.token });
    expired.emit('auction:join', { auctionId });
    expect((await expired.waitFor('auction:error')).code).toBe('AUTH_REQUIRED');
  });
});

describe('Requisitos para pujar', () => {
  const email = 'nuevo@test.com';
  let N: string;
  let next: number;

  beforeAll(async () => {
    await app.api('POST', '/auth/register', { email, password: 'nuevo12345', firstName: 'Nuevo', lastName: 'Postor' });
    const token = await tokenDeVerificacion(app, email);
    N = (await app.api('POST', '/auth/verify-email', { token })).data.token;
    await app.sql('UPDATE users SET credit_balance = 1000000 WHERE email = $1', [email]);
    const current = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots[0];
    next = Number(current.currentPrice) + Number(current.bidIncrement);
  });

  it('sin datos personales completos no se puede pujar (aunque tenga crédito)', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/lotes/${lot.id}/pujas`, { amount: next }, N);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/datos/);
  });

  it('al completar los datos queda profileComplete = true y ya puede pujar', async () => {
    const upd = await app.api('PATCH', '/auth/me', { ...DATOS_COMPLETOS, dni: '40111222' }, N);
    expect(upd.data.user.profileComplete).toBe(true);
    expect((await app.api('POST', `/subastas/${auctionId}/lotes/${lot.id}/pujas`, { amount: next }, N)).status).toBe(201);
  });
});

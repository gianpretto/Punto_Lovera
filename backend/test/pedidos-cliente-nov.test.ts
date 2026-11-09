import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { crearPostor, startTestApp, type TestApp } from './helpers/app';

// Pedidos del cliente (reunión nov 2026): celular por WhatsApp, validaciones,
// baja de cuenta, modos de crédito, controles del martillero en vivo y
// moderación del chat.

let app: TestApp;
let A: string; // admin
let U1: string; // usuario del seed (datos completos, 500.000)
let U2: string; // segundo postor (1.000.000)
let auctionId: string;
let lots: { id: string; number: number; startingPrice: string; bidIncrement: string }[];

const me = async (token: string) => (await app.api('GET', '/auth/me', null, token)).data.user;
const bid = (lotId: string, amount: number, token: string) =>
  app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/pujas`, { amount }, token);
const modo = (body: Record<string, unknown>) => app.api('PUT', '/admin/configuracion/creditos', body, A);
const userIdOf = async (token: string) => (await me(token)).id as string;

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U1 = await app.login('usuario@test.com', 'user1234');
  U2 = await crearPostor(app, 'postor2@test.com', 'postor1234', 1_000_000);
  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  lots = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots;
  // Lotes extra para los controles en vivo y la moderación
  for (const number of [91, 92, 93]) {
    await app.api(
      'POST',
      `/subastas/${auctionId}/lotes`,
      { number, title: `Lote ${number}`, description: 'Prueba', startingPrice: 100000, bidIncrement: 10000 },
      A
    );
  }
  lots = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots;
  await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
});
afterAll(async () => {
  await app?.close();
});

describe('Celular verificado por WhatsApp', () => {
  let N: string;
  beforeAll(async () => {
    await app.api('POST', '/auth/register', { email: 'cel@test.com', password: 'clave12345', firstName: 'Cel', lastName: 'Lular' });
    N = await app.login('cel@test.com', 'clave12345');
  });

  it('valida código de área y número (10 dígitos en total)', async () => {
    expect((await app.api('POST', '/auth/me/celular', { areaCode: '011', phone: '12345678' }, N)).status).toBe(400);
    expect((await app.api('POST', '/auth/me/celular', { areaCode: '11', phone: '1234567' }, N)).status).toBe(400);
    expect((await app.api('POST', '/auth/me/celular', { areaCode: '11', phone: '15123456789' }, N)).status).toBe(400);
  });

  it('manda el código (sin WhatsApp configurado va a los logs) y con el correcto queda verificado', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const res = await app.api('POST', '/auth/me/celular', { areaCode: '221', phone: '5551234' }, N);
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ codeSent: true, user: { phoneVerified: false, phoneAreaCode: '221', phone: '5551234' } });
    const linea = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes('+5492215551234'));
    log.mockRestore();
    const code = linea?.match(/código de verificación: (\d{6})/)?.[1];
    expect(code).toBeDefined();

    const mal = await app.api('POST', '/auth/me/celular/verificar', { code: code === '000000' ? '111111' : '000000' }, N);
    expect(mal.status).toBe(400);
    const ok = await app.api('POST', '/auth/me/celular/verificar', { code }, N);
    expect(ok.status).toBe(200);
    expect(ok.data.user.phoneVerified).toBe(true);
  });

  it('con 5 intentos fallidos hay que pedir otro código', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await app.api('POST', '/auth/me/celular', { areaCode: '11', phone: '44445555' }, N);
    vi.restoreAllMocks();
    for (let i = 0; i < 5; i++) await app.api('POST', '/auth/me/celular/verificar', { code: '999999' }, N);
    const res = await app.api('POST', '/auth/me/celular/verificar', { code: '999999' }, N);
    expect(res.data.error).toMatch(/pedí uno nuevo/);
  });

  it('sin celular verificado el perfil queda incompleto aunque tenga DNI', async () => {
    const res = await app.api('PATCH', '/auth/me', { dni: '30111223' }, N);
    expect(res.data.user.profileComplete).toBe(false);
  });
});

describe('Validaciones de los formularios', () => {
  it('nombres largos, con números o vacíos se rechazan', async () => {
    const largo = 'a'.repeat(61);
    expect((await app.api('PATCH', '/auth/me', { firstName: largo }, U1)).status).toBe(400);
    expect((await app.api('PATCH', '/auth/me', { lastName: 'P3rez' }, U1)).status).toBe(400);
    expect((await app.api('PATCH', '/auth/me', { firstName: '   ' }, U1)).status).toBe(400);
    expect((await app.api('PATCH', '/auth/me', { firstName: 'José María' }, U1)).status).toBe(200);
  });

  it('DNI de 7-8 números o CUIL válido', async () => {
    expect((await app.api('PATCH', '/auth/me', { dni: '123' }, U1)).status).toBe(400);
    expect((await app.api('PATCH', '/auth/me', { dni: '20123456780' }, U1)).status).toBe(400); // verificador mal
    const cuil = await app.api('PATCH', '/auth/me', { dni: '20-12345678-6' }, U1);
    expect(cuil.status).toBe(200);
    expect(cuil.data.user.dni).toBe('20123456786');
    await app.api('PATCH', '/auth/me', { dni: '30111222' }, U1);
  });

  it('dirección, código postal y mensajes tienen largo máximo', async () => {
    expect((await app.api('PATCH', '/auth/me', { address: 'x'.repeat(121) }, U1)).status).toBe(400);
    expect((await app.api('PATCH', '/auth/me', { zipCode: '12' }, U1)).status).toBe(400);
    expect((await app.api('PATCH', '/auth/me', { zipCode: 'b1878abc' }, U1)).data.user.zipCode).toBe('B1878ABC');
    const contacto = await app.api('POST', '/contacto', { name: 'Ana', email: 'ana@x.com', message: 'x'.repeat(2001) });
    expect(contacto.status).toBe(400);
    const registro = await app.api('POST', '/auth/register', {
      email: 'largo@test.com',
      password: 'clave12345',
      firstName: 'x'.repeat(40_000),
      lastName: 'Y',
    });
    expect(registro.status).toBe(400);
  });

  it('el reintegro pide titular y CUIT/CUIL válidos', async () => {
    const base = { amount: 1000, cbu: '0000003100000000000001' };
    expect((await app.api('POST', '/creditos/reintegros', base, U1)).status).toBe(400);
    const malCuit = await app.api('POST', '/creditos/reintegros', { ...base, accountHolder: 'Juan Pérez', cuit: '20123456780' }, U1);
    expect(malCuit.status).toBe(400);
  });
});

describe('Configuración del admin', () => {
  it('solo el admin la ve y la cambia', async () => {
    expect((await app.api('GET', '/admin/configuracion', null, U1)).status).toBe(403);
    const res = await app.api('GET', '/admin/configuracion', null, A);
    expect(res.data.creditos).toEqual({ modo: 'CREDITO', porcentajeGarantia: 10 });
  });

  it('los datos de transferencia se editan y se ven en /creditos', async () => {
    const datos = { alias: 'punto.lovera', cbu: '0000003100000000000001', holder: 'Punto Lovera SRL', cuit: '30-71234567-1', account: 'CC $' };
    const bad = await app.api('PUT', '/admin/configuracion/transferencia', { ...datos, cuit: '123' }, A);
    expect(bad.status).toBe(400);
    // 30-71234567-? con el dígito correcto
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const base = '3071234567';
    const r = 11 - (pesos.reduce((a, p, i) => a + p * Number(base[i]), 0) % 11);
    const cuit = base + (r === 11 ? 0 : r === 10 ? 9 : r);
    expect((await app.api('PUT', '/admin/configuracion/transferencia', { ...datos, cuit }, A)).status).toBe(200);
    const pub = await app.api('GET', '/creditos/transferencia');
    expect(pub.data.transfer).toMatchObject({ alias: 'punto.lovera', cuit, holder: 'Punto Lovera SRL' });
  });

  it('el modo de créditos se valida y es público', async () => {
    expect((await modo({ modo: 'OTRO' })).status).toBe(400);
    expect((await modo({ modo: 'GARANTIA', porcentajeGarantia: 0 })).status).toBe(400);
    expect((await modo({ modo: 'GARANTIA', porcentajeGarantia: 20 })).status).toBe(200);
    expect((await app.api('GET', '/config')).data.creditos).toEqual({ modo: 'GARANTIA', porcentajeGarantia: 20 });
  });
});

describe('Modos de crédito al ofertar', () => {
  let N: string; // postor sin crédito
  beforeAll(async () => {
    N = await crearPostor(app, 'sincredito@test.com', 'clave12345', 0);
  });

  it('SIN_CREDITO: se oferta sin saldo y al adjudicar no se descuenta nada', async () => {
    await modo({ modo: 'SIN_CREDITO' });
    await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lots[0].id }, A);
    const min = Number(lots[0].startingPrice) + Number(lots[0].bidIncrement);
    expect((await bid(lots[0].id, min, N)).status).toBe(201);
    expect((await me(N)).heldCredit).toBe(0);
    expect((await app.api('POST', `/compras/cerrar-lote/${lots[0].id}`, null, A)).status).toBe(201);
    expect((await me(N)).creditBalance).toBe(0);
  });

  it('GARANTIA: alcanza con tener el % de la oferta; se reserva y se descuenta ese %', async () => {
    await modo({ modo: 'GARANTIA', porcentajeGarantia: 10 });
    await app.sql("UPDATE users SET credit_balance = 50000 WHERE email = 'sincredito@test.com'");
    await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lots[1].id }, A);
    const caro = await bid(lots[1].id, 600_000, N); // garantía 60.000 > 50.000
    expect(caro.status).toBe(400);
    expect(caro.data.error).toMatch(/garantía de \$60\.000/);
    expect((await bid(lots[1].id, 400_000, N)).status).toBe(201); // 40.000
    expect(await me(N)).toMatchObject({ heldCredit: 40000, availableCredit: 10000 });
    expect((await app.api('POST', `/compras/cerrar-lote/${lots[1].id}`, null, A)).status).toBe(201);
    expect(await me(N)).toMatchObject({ creditBalance: 10000, heldCredit: 0 });
  });

  afterAll(async () => {
    await modo({ modo: 'CREDITO', porcentajeGarantia: 10 });
  });
});

describe('Controles del martillero en vivo', () => {
  let lot: (typeof lots)[number];
  const estado = async () => (await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lot.id }, A)).data.lot;

  beforeAll(async () => {
    lot = lots[2];
  });

  it('un usuario común no puede usarlos', async () => {
    expect((await app.api('PATCH', `/subastas/${auctionId}/lotes/${lot.id}/vivo`, { bidIncrement: 1 }, U1)).status).toBe(403);
  });

  it('fija la próxima oferta mínima y el incremento; la mínima manual se borra con la próxima oferta', async () => {
    const base = await estado();
    const res = await app.api('PATCH', `/subastas/${auctionId}/lotes/${lot.id}/vivo`, { nextMinBid: base.currentPrice + 50_000 }, A);
    expect(res.status).toBe(200);
    expect(res.data.lot).toMatchObject({ minNextBid: base.currentPrice + 50_000, minNextBidManual: true });
    expect((await bid(lot.id, base.currentPrice + 10_000, U1)).status).toBe(400);
    expect((await bid(lot.id, base.currentPrice + 50_000, U1)).status).toBe(201);

    const inc = await app.api('PATCH', `/subastas/${auctionId}/lotes/${lot.id}/vivo`, { bidIncrement: 25_000 }, A);
    expect(inc.data.lot).toMatchObject({ bidIncrement: 25000, minNextBid: base.currentPrice + 75_000, minNextBidManual: false });
  });

  it('anular la oferta ganadora vuelve a la anterior (o al precio base sin ganador)', async () => {
    const base = await estado();
    const id2 = await userIdOf(U2);
    expect((await bid(lot.id, base.minNextBid, U2)).status).toBe(201);
    const pujas = (await app.api('GET', `/subastas/${auctionId}/lotes/${lot.id}/pujas`, null, A)).data.bids;
    const deU2 = pujas.find((b: { userId: string }) => b.userId === id2);

    const res = await app.api('POST', `/subastas/${auctionId}/pujas/${deU2.id}/anular`, null, A);
    expect(res.status).toBe(200);
    expect(res.data.lot).toMatchObject({ currentPrice: base.currentPrice, leaderId: await userIdOf(U1) });
    expect((await app.api('POST', `/subastas/${auctionId}/pujas/${deU2.id}/anular`, null, A)).status).toBe(400);

    const deU1 = pujas.find((b: { userId: string }) => b.userId !== id2);
    const sinNadie = await app.api('POST', `/subastas/${auctionId}/pujas/${deU1.id}/anular`, null, A);
    expect(sinNadie.data.lot).toMatchObject({ currentPrice: Number(lot.startingPrice), leaderId: null });
    expect((await me(U1)).heldCredit).toBe(0);
  });

  it('corrige a mano el precio y el ganador (solo alguien que ofertó)', async () => {
    const base = await estado();
    expect((await bid(lot.id, base.minNextBid, U2)).status).toBe(201);
    const noOferto = await app.api('PATCH', `/subastas/${auctionId}/lotes/${lot.id}/vivo`, { leaderId: await userIdOf(U1) }, A);
    expect(noOferto.status).toBe(400);
    const res = await app.api('PATCH', `/subastas/${auctionId}/lotes/${lot.id}/vivo`, { currentPrice: 1, leaderId: null }, A);
    expect(res.data.lot).toMatchObject({ currentPrice: 1, leaderId: null });
  });

  it('siguiente lote pasa al próximo sin vender', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/siguiente-lote`, null, A);
    expect(res.status).toBe(200);
    expect(res.data.lot.number).toBeGreaterThan(lot.number);
  });
});

describe('Moderación del chat', () => {
  it('silenciado no puede escribir; expulsado no entra ni oferta; se puede deshacer', async () => {
    const id2 = await userIdOf(U2);
    const sala = app.room({ token: U2 });
    sala.emit('auction:join', { auctionId });
    await sala.waitFor('auction:state');

    const sil = await app.api('POST', `/subastas/${auctionId}/sanciones`, { userId: id2, type: 'SILENCIADO' }, A);
    expect(sil.status).toBe(201);
    expect(await sala.waitFor('auction:sanction')).toMatchObject({ type: 'SILENCIADO', active: true });
    sala.emit('chat:message', { auctionId, text: 'hola' });
    expect((await sala.waitFor('chat:error')).message).toMatch(/silenció/);

    // No se puede sancionar al staff
    expect((await app.api('POST', `/subastas/${auctionId}/sanciones`, { userId: await userIdOf(A), type: 'EXPULSADO' }, A)).status).toBe(400);

    await app.api('POST', `/subastas/${auctionId}/sanciones`, { userId: id2, type: 'EXPULSADO' }, A);
    expect((await sala.waitFor('auction:error', (p) => p.code === 'EXPULSADO')).message).toMatch(/expulsó/);
    const actual = (await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lots[3].id }, A)).data.lot;
    expect((await bid(actual.id, actual.minNextBid, U2)).status).toBe(403);
    const otra = app.room({ token: U2 });
    otra.emit('auction:join', { auctionId });
    expect((await otra.waitFor('auction:error')).code).toBe('EXPULSADO');

    const lista = (await app.api('GET', `/subastas/${auctionId}/sanciones`, null, A)).data.sanctions;
    expect(lista).toHaveLength(2);
    for (const s of lista) {
      expect((await app.api('DELETE', `/subastas/${auctionId}/sanciones/${s.id}`, null, A)).status).toBe(200);
    }
    expect((await bid(actual.id, actual.minNextBid, U2)).status).toBe(201);
  });

  it('los mensajes del chat traen el userId (para moderar)', async () => {
    const sala = app.room({ token: U1 });
    sala.emit('auction:join', { auctionId });
    await sala.waitFor('auction:state');
    sala.emit('chat:message', { auctionId, text: 'buenas' });
    expect((await sala.waitFor('chat:message', (m) => m.text === 'buenas')).userId).toBe(await userIdOf(U1));
  });
});

describe('Baja de la cuenta', () => {
  it('no se puede con crédito cargado; sin crédito borra los datos y no deja entrar', async () => {
    const T = await crearPostor(app, 'baja@test.com', 'clave12345', 1000);
    expect((await app.api('DELETE', '/auth/me', { password: 'mal' }, T)).status).toBe(400);
    const conCredito = await app.api('DELETE', '/auth/me', { password: 'clave12345' }, T);
    expect(conCredito.data.error).toMatch(/reintegro/);

    await app.sql("UPDATE users SET credit_balance = 0 WHERE email = 'baja@test.com'");
    expect((await app.api('DELETE', '/auth/me', { password: 'clave12345' }, T)).status).toBe(200);
    expect((await app.api('GET', '/auth/me', null, T)).status).toBe(401);
    expect((await app.api('POST', '/auth/login', { email: 'baja@test.com', password: 'clave12345' })).status).toBe(400);
    // El mail queda libre (para registrarse de nuevo) y los datos personales borrados
    const filas = await app.sql<{ email: string; dni: string | null; phone: string | null }>(
      "SELECT email, dni, phone FROM users WHERE email LIKE 'baja-%'"
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ dni: null, phone: null });
  });
});

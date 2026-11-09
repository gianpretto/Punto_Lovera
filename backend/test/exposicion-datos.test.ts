import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearPostor, formConArchivos, PNG, startTestApp, type TestApp } from './helpers/app';

// Revisión de seguridad (nov 2026): lo que ve un visitante sin cuenta o un
// usuario común no puede traer datos personales de OTROS usuarios (mail,
// DNI, celular, dirección, saldo, CBU...) ni datos internos (hashes, claves).
// Se recorren las respuestas y los eventos de la sala buscando esas claves.

const CLAVES_PROHIBIDAS = [
  'email',
  'dni',
  'phone',
  'phoneAreaCode',
  'address',
  'birthDate',
  'zipCode',
  'creditBalance',
  'cbu',
  'cuit',
  'passwordHash',
  'verificationToken',
  'resetToken',
  'googleId',
  'phoneCodeHash',
  'sessionVersion',
  'cameraId',
  'token',
];

/** Rutas "a.b.c" de cada clave prohibida que aparezca en el objeto */
function buscar(obj: unknown, ruta = '', encontradas: string[] = []) {
  if (Array.isArray(obj)) obj.forEach((v, i) => buscar(v, `${ruta}[${i}]`, encontradas));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (CLAVES_PROHIBIDAS.includes(k) && v !== null && v !== undefined) encontradas.push(`${ruta}.${k}`);
      buscar(v, `${ruta}.${k}`, encontradas);
    }
  }
  return encontradas;
}

let app: TestApp;
let A: string;
let U1: string;
let U2: string;
let auctionId: string;
let lotId: string;

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U1 = await app.login('usuario@test.com', 'user1234');
  U2 = await crearPostor(app, 'curioso@test.com', 'curioso1234', 1_000_000);
  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  const auction = (await app.api('GET', `/subastas/${auctionId}`)).data.auction;
  lotId = auction.lots[0].id;
  await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
  await app.api('POST', `/subastas/${auctionId}/camara`, {}, A);
  // Actividad de U1: oferta, comprobante y reintegro
  const lot = auction.lots[0];
  await app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/pujas`, { amount: Number(lot.currentPrice) + Number(lot.bidIncrement) }, U1);
  await app.api('POST', '/creditos', formConArchivos('comprobante', [{ data: PNG, type: 'image/png', name: 'c.png' }], { amount: '1000' }), U1);
  await app.api('POST', '/creditos/reintegros', { amount: 1000, cbu: '0000003100000000000001', accountHolder: 'Usuario Test', cuit: '20-12345678-6' }, U1);
  await app.api('POST', '/contacto', { name: 'Ana', email: 'ana@x.com', message: 'Hola' });
});
afterAll(async () => {
  await app?.close();
});

describe('Lo público y lo de otro usuario no trae datos personales', () => {
  const rutasPublicas = () => [
    '/subastas',
    '/subastas?status=ACTIVA,PROXIMA&page=1&pageSize=6',
    `/subastas/${auctionId}`,
    `/subastas/${auctionId}?lots=false`,
    `/subastas/${auctionId}/lotes?page=1&pageSize=6`,
    `/subastas/${auctionId}/lotes/${lotId}`,
    '/config',
    '/auth/google/config',
  ];

  it('sin cuenta', async () => {
    for (const ruta of rutasPublicas()) {
      const res = await app.api('GET', ruta);
      expect(res.status, ruta).toBe(200);
      expect(buscar(res.data), ruta).toEqual([]);
    }
  });

  it('con la cuenta de otro usuario (U2 mirando lo de U1)', async () => {
    for (const ruta of [...rutasPublicas(), '/compras/mias', '/compras/ofertas', '/creditos/mios', '/creditos/reintegros/mios']) {
      const res = await app.api('GET', ruta, null, U2);
      expect(res.status, ruta).toBe(200);
      expect(buscar(res.data), ruta).toEqual([]);
    }
  });

  it('un usuario común no accede a lo de admin/martillero', async () => {
    const rutas: [string, string][] = [
      ['GET', `/subastas/${auctionId}/lotes/${lotId}/pujas`],
      ['GET', `/subastas/${auctionId}/pases`],
      ['GET', `/subastas/${auctionId}/camara`],
      ['GET', `/subastas/${auctionId}/sanciones`],
      ['GET', '/creditos/pendientes'],
      ['GET', '/creditos/reintegros/pendientes'],
      ['GET', '/contacto'],
      ['GET', '/admin/configuracion'],
      ['POST', `/subastas/${auctionId}/siguiente-lote`],
      ['PATCH', `/subastas/${auctionId}`],
      ['POST', `/compras/cerrar-lote/${lotId}`],
    ];
    for (const [m, ruta] of rutas) {
      const body = m === 'GET' ? undefined : {};
      expect((await app.api(m, ruta, body, U2)).status, `${m} ${ruta}`).toBe(403);
      expect((await app.api(m, ruta, body)).status, `${m} ${ruta} sin cuenta`).toBe(401);
    }
  });

  it('el comprobante de otro usuario no se puede descargar', async () => {
    const [{ id }] = await app.sql<{ id: string }>('SELECT id FROM credit_vouchers LIMIT 1');
    expect((await app.api('GET', `/creditos/${id}/archivo`, null, U2)).status).toBe(403);
    expect((await app.api('GET', `/creditos/${id}/archivo`)).status).toBe(401);
  });

  it('/auth/me no trae hashes ni datos internos', async () => {
    const res = await app.api('GET', '/auth/me', null, U1);
    const internas = buscar(res.data).filter((r) => /Hash|Token|googleId|sessionVersion/.test(r));
    expect(internas).toEqual([]);
  });

  it('lo que ve el admin tampoco trae hashes ni la clave de OBS (salvo en /camara)', async () => {
    const internas = (d: unknown) => buscar(d).filter((r) => /Hash|Token|googleId|sessionVersion|cameraId/.test(r));
    for (const ruta of ['/creditos/pendientes', '/creditos/reintegros/pendientes', `/subastas/${auctionId}/lotes/${lotId}/pujas`, '/contacto']) {
      const res = await app.api('GET', ruta, null, A);
      expect(res.status, ruta).toBe(200);
      expect(internas(res.data), ruta).toEqual([]);
    }
  });
});

describe('Eventos de la sala', () => {
  it('lo que recibe otro usuario no trae datos personales', async () => {
    const espia = app.room({ token: U2 });
    const recibidos: { ev: string; payload: unknown }[] = [];
    espia.socket.onAny((ev: string, payload: unknown) => recibidos.push({ ev, payload }));
    espia.emit('auction:join', { auctionId });
    await espia.waitFor('auction:state');

    const sala = app.room({ token: U1 });
    sala.emit('auction:join', { auctionId });
    await sala.waitFor('auction:state');
    sala.emit('chat:message', { auctionId, text: 'hola' });
    await espia.waitFor('chat:message', (m) => m.text === 'hola');

    for (const { ev, payload } of recibidos) expect(buscar(payload), ev).toEqual([]);
  });

  it('payloads raros no tiran el server ni se aceptan montos absurdos (ni sin crédito)', async () => {
    await app.api('PUT', '/admin/configuracion/creditos', { modo: 'SIN_CREDITO' }, A);
    const sala = app.room({ token: U2 });
    sala.emit('auction:join', { auctionId });
    await sala.waitFor('auction:state');
    for (const amount of [1e300, -5, 'mucho', Infinity]) {
      sala.emit('bid:place', { lotId, amount });
      expect((await sala.waitFor('bid:error')).message).toBeTruthy();
    }
    await app.api('PUT', '/admin/configuracion/creditos', { modo: 'CREDITO' }, A);
    sala.emit('bid:place', null);
    sala.emit('chat:message', { auctionId, text: { $gt: '' } });
    sala.emit('auction:join', { auctionId: 'x'.repeat(10_000) });
    expect((await app.api('GET', '/health')).status).toBe(200);
  });
});

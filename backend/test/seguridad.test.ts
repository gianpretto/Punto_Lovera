import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATOS_COMPLETOS, formConArchivos, startTestApp, tokenDeVerificacion, type TestApp } from './helpers/app';

// Endurecimiento: límites de intentos, mail verificado para pujar, links
// de verificación que vencen, reglas de la sala (join, subasta activa,
// anti-flood) y validación de archivos/JSON.
//
// Los límites de intentos (express-rate-limit) viven en memoria del proceso;
// vitest carga la app de cero en cada archivo, así que los contadores
// arrancan en 0 acá y no se cruzan con otros archivos.

let app: TestApp;
let A: string;
let U: string;
let auctionId: string;
let lotId: string;

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');
  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  lotId = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots[0].id;
});
afterAll(async () => {
  await app?.close();
});

describe('Límite de intentos de login', () => {
  it('al 11º intento fallido para el mismo email responde 429', async () => {
    const intento = () => app.api('POST', '/auth/login', { email: 'atacado@test.com', password: 'adivinando' });
    for (let i = 1; i <= 10; i++) expect((await intento()).status).toBe(400);
    const bloqueado = await intento();
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.data.error).toMatch(/Demasiados intentos/);
  });

  it('el bloqueo es por IP + email: otro usuario de la misma IP entra igual', async () => {
    const res = await app.api('POST', '/auth/login', { email: 'usuario@test.com', password: 'user1234' });
    expect(res.status).toBe(200);
  });
});

describe('Verificación de mail', () => {
  const email = 'sinverificar@test.com';
  let N: string;

  beforeAll(async () => {
    await app.api('POST', '/auth/register', { email, password: 'nuevo12345', firstName: 'Sin', lastName: 'Verificar' });
    N = await app.login(email, 'nuevo12345'); // el login no exige mail verificado
    await app.sql('UPDATE users SET credit_balance = 1000000 WHERE email = $1', [email]);
    await app.api('PATCH', '/auth/me', { ...DATOS_COMPLETOS, dni: '35123456' }, N);
    await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
  });

  it('con el mail sin verificar no se puede pujar (aunque tenga crédito y datos)', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/pujas`, { amount: 155000 }, N);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/Verificá tu mail/);
  });

  it('un link de verificación de hace más de 48 h está vencido', async () => {
    const token = await tokenDeVerificacion(app, email, 49);
    const res = await app.api('POST', '/auth/verify-email', { token });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/venció/);
  });

  it('un link vigente verifica el mail, y no se puede reusar', async () => {
    const token = await tokenDeVerificacion(app, email, 47);
    expect((await app.api('POST', '/auth/verify-email', { token })).status).toBe(200);
    expect((await app.api('POST', '/auth/verify-email', { token })).status).toBe(400);
  });

  it('ya verificado, puede pujar', async () => {
    const res = await app.api('POST', `/subastas/${auctionId}/lotes/${lotId}/pujas`, { amount: 155000 }, N);
    expect(res.status).toBe(201);
  });
});

describe('Reglas de la sala en vivo', () => {
  it('sin auction:join no se puede chatear ni pujar', async () => {
    const room = app.room({ token: U });
    room.emit('chat:message', { auctionId, text: 'hola' });
    expect((await room.waitFor('chat:error')).message).toMatch(/Entrá a la sala/);
    room.emit('bid:place', { lotId, amount: 200000 });
    expect((await room.waitFor('bid:error')).message).toMatch(/Entrá a la sala/);
  });

  it('payloads inválidos no rompen el server', async () => {
    const room = app.room({ token: U });
    room.emit('auction:join', null);
    room.emit('bid:place', { lotId: 123, amount: 'mucho' });
    expect((await room.waitFor('bid:error')).message).toBe('Puja inválida');
    expect((await app.api('GET', '/health')).status).toBe(200);
  });

  it('el chat solo funciona con la subasta ACTIVA', async () => {
    // Otra subasta, PROXIMA: se puede entrar a mirar pero no chatear
    const proxima = (
      await app.api(
        'POST',
        '/subastas',
        { title: 'Próxima', description: 'd', location: 'l', startsAt: new Date(Date.now() + 864e5).toISOString() },
        A
      )
    ).data.auction.id;
    const room = app.room({ token: A });
    room.emit('auction:join', { auctionId: proxima });
    await room.waitFor('auction:state');
    room.emit('chat:message', { auctionId: proxima, text: 'hola' });
    expect((await room.waitFor('chat:error')).message).toMatch(/en vivo/);
  });

  it('límite de chat por usuario: el 6º mensaje en 10 s se rechaza', async () => {
    const room = app.room({ token: U });
    room.emit('auction:join', { auctionId });
    await room.waitFor('auction:state');
    for (let i = 1; i <= 5; i++) {
      room.emit('chat:message', { auctionId, text: `mensaje ${i}` });
      await room.waitFor('chat:message', (m) => m.text === `mensaje ${i}`);
    }
    room.emit('chat:message', { auctionId, text: 'mensaje 6' });
    expect((await room.waitFor('chat:error')).message).toMatch(/muy seguido/);
  });

  it('el límite es por usuario: abrir otro socket no da más cupo', async () => {
    const otro = app.room({ token: U });
    otro.emit('auction:join', { auctionId });
    await otro.waitFor('auction:state');
    otro.emit('chat:message', { auctionId, text: 'desde otra pestaña' });
    expect((await otro.waitFor('chat:error')).message).toMatch(/muy seguido/);
  });
});

describe('Archivos y cuerpos inválidos', () => {
  it('un comprobante .txt → 400 con el motivo', async () => {
    const form = formConArchivos('comprobante', [{ data: Buffer.from('hola'), type: 'text/plain', name: 'c.txt' }], {
      amount: '1000',
    });
    const res = await app.api('POST', '/creditos', form, U);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/imagen o un PDF/);
  });

  it('una "imagen" llamada .html se guarda con la extensión de su tipo real', async () => {
    const form = formConArchivos('comprobante', [{ data: Buffer.from('x'), type: 'image/png', name: 'x.html' }], {
      amount: '1000',
    });
    const res = await app.api('POST', '/creditos', form, U);
    expect(res.status).toBe(201);
    expect(res.data.voucher.fileUrl).toMatch(/\.png$/);
  });

  it('JSON mal formado → 400 y JSON gigante → 413 (no 500)', async () => {
    const send = (body: string) =>
      fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    expect((await send('{"email":')).status).toBe(400);
    expect((await send(JSON.stringify({ email: 'x'.repeat(200 * 1024) }))).status).toBe(413);
  });
});

describe('Revisión de seguridad (checklist)', () => {
  it('un id que no es uuid devuelve 400, no 500', async () => {
    const res = await app.api('GET', '/subastas/esto-no-es-un-uuid');
    expect(res.status).toBe(400);
    expect(res.data.error).toBe('Identificador inválido');
  });

  it('la lista de pujas con nombres solo la ve el martillero o el admin', async () => {
    const path = `/subastas/${auctionId}/lotes/${lotId}/pujas`;
    expect((await app.api('GET', path)).status).toBe(401);
    expect((await app.api('GET', path, null, U)).status).toBe(403);
    expect((await app.api('GET', path, null, A)).status).toBe(200);
  });

  it('no acepta contraseñas de más de 72 bytes (bcrypt las truncaría)', async () => {
    const res = await app.api('POST', '/auth/register', {
      email: 'larga@test.com',
      password: 'x'.repeat(73),
      firstName: 'A',
      lastName: 'B',
    });
    expect(res.status).toBe(400);
  });

  it('rechaza un JWT sin firma (alg "none") aunque diga ser admin', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const falso = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: '00000000-0000-0000-0000-000000000000', role: 'ADMIN' })}.`;
    expect((await app.api('GET', '/creditos/pendientes', null, falso)).status).toBe(401);
  });
});

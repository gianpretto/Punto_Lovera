import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Reintegros: el usuario pide que le devuelvan crédito que no usó. Al
// pedirlo el monto queda reservado; el admin transfiere por fuera de la
// plataforma y lo aprueba (recién ahí se descuenta) o lo rechaza (se libera).

let app: TestApp;
let A: string;
let U: string; // usuario del seed: saldo 500.000

const CBU = '0000003100000000000001';
const pedir = (amount: number, token = U, extra: Record<string, unknown> = {}) =>
  app.api('POST', '/creditos/reintegros', { amount, cbu: CBU, ...extra }, token);
const me = async () => (await app.api('GET', '/auth/me', null, U)).data.user;

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');
});
afterAll(async () => {
  await app?.close();
});

describe('Pedir un reintegro', () => {
  it('sin sesión → 401', async () => {
    expect((await pedir(1000, '')).status).toBe(401);
  });

  it('valida el CBU (22 dígitos; acepta espacios y guiones al pegarlo)', async () => {
    const bad = await app.api('POST', '/creditos/reintegros', { amount: 1000, cbu: '123' }, U);
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.data)).toMatch(/22 dígitos/);
  });

  it('no se puede pedir más que el crédito disponible', async () => {
    const res = await pedir(600000);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/Podés pedir hasta/);
  });

  it('el pedido queda PENDIENTE y reserva el monto', async () => {
    const res = await pedir(200000, U, { cbu: '0000-0031 0000 0000 0000 01', alias: 'mi.alias' });
    expect(res.status).toBe(201);
    expect(res.data.withdrawal).toMatchObject({ status: 'PENDIENTE', cbu: CBU, alias: 'mi.alias' });
    expect(await me()).toMatchObject({ creditBalance: 500000, heldCredit: 200000, availableCredit: 300000 });
  });

  it('lo reservado no se puede volver a pedir', async () => {
    expect((await pedir(300001)).status).toBe(400);
    expect((await pedir(100000)).status).toBe(201);
    expect(await me()).toMatchObject({ heldCredit: 300000, availableCredit: 200000 });
  });

  it('aparece en /creditos/reintegros/mios', async () => {
    const res = await app.api('GET', '/creditos/reintegros/mios', null, U);
    expect(res.data.withdrawals).toHaveLength(2);
  });

  it('lo reservado por un reintegro tampoco se puede usar para pujar', async () => {
    const auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
    await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
    const lot = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots[0];
    // Disponible: 200.000. Una puja de 205.000 entra en el saldo pero no en lo disponible
    const res = await app.api('POST', `/subastas/${auctionId}/lotes/${lot.id}/pujas`, { amount: 205000 }, U);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/reintegros pendientes/);
  });
});

describe('Revisión del admin', () => {
  let pendientes: { id: string; amount: string; user: { email: string } }[];
  const de = (monto: number) => pendientes.find((w) => Number(w.amount) === monto)!;

  it('un usuario común no ve ni revisa los pendientes (403)', async () => {
    expect((await app.api('GET', '/creditos/reintegros/pendientes', null, U)).status).toBe(403);
    const [{ id }] = await app.sql<{ id: string }>('SELECT id FROM credit_withdrawals LIMIT 1');
    expect((await app.api('POST', `/creditos/reintegros/${id}/aprobar`, null, U)).status).toBe(403);
    expect((await app.api('POST', `/creditos/reintegros/${id}/rechazar`, { reason: 'x' }, U)).status).toBe(403);
  });

  it('el admin ve los pendientes con los datos del usuario', async () => {
    const res = await app.api('GET', '/creditos/reintegros/pendientes', null, A);
    expect(res.status).toBe(200);
    pendientes = res.data.withdrawals;
    expect(pendientes).toHaveLength(2);
    expect(de(200000).user.email).toBe('usuario@test.com');
  });

  it('un id inexistente o mal formado → 404', async () => {
    expect((await app.api('POST', '/creditos/reintegros/no-es-un-uuid/aprobar', null, A)).status).toBe(404);
    const otro = '00000000-0000-0000-0000-000000000000';
    expect((await app.api('POST', `/creditos/reintegros/${otro}/aprobar`, null, A)).status).toBe(404);
  });

  it('aprobar descuenta el saldo una sola vez', async () => {
    const res = await app.api('POST', `/creditos/reintegros/${de(200000).id}/aprobar`, null, A);
    expect(res.status).toBe(200);
    expect(res.data.withdrawal.status).toBe('APROBADO');
    expect(await me()).toMatchObject({ creditBalance: 300000, heldCredit: 100000, availableCredit: 200000 });

    expect((await app.api('POST', `/creditos/reintegros/${de(200000).id}/aprobar`, null, A)).status).toBe(400);
    expect((await me()).creditBalance).toBe(300000);
  });

  it('rechazar exige motivo, libera la reserva y no toca el saldo', async () => {
    const id = de(100000).id;
    expect((await app.api('POST', `/creditos/reintegros/${id}/rechazar`, { reason: '  ' }, A)).status).toBe(400);

    const res = await app.api('POST', `/creditos/reintegros/${id}/rechazar`, { reason: 'CBU de otra persona' }, A);
    expect(res.status).toBe(200);
    expect(res.data.withdrawal).toMatchObject({ status: 'RECHAZADO', rejectionReason: 'CBU de otra persona' });
    expect(await me()).toMatchObject({ creditBalance: 300000, heldCredit: 0, availableCredit: 300000 });
  });

  it('un reintegro ya revisado no se puede rechazar ni aprobar', async () => {
    expect((await app.api('POST', `/creditos/reintegros/${de(100000).id}/rechazar`, { reason: 'otra vez' }, A)).status).toBe(400);
    expect((await app.api('POST', `/creditos/reintegros/${de(100000).id}/aprobar`, null, A)).status).toBe(400);
    expect((await app.api('GET', '/creditos/reintegros/pendientes', null, A)).data.withdrawals).toHaveLength(0);
  });
});

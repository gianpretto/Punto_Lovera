import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Carga de crédito sin pasarela de pago: el usuario sube el comprobante de
// la transferencia, el admin lo revisa y recién ahí se acredita el saldo.
// Los archivos son privados (tienen datos bancarios). Además: ofertas en curso.

let app: TestApp;
let A: string;
let U: string;
let O: string; // otro usuario, sin relación con los comprobantes de U

// PNG de 1x1
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
function comprobante(amount?: number) {
  const form = new FormData();
  if (amount !== undefined) form.append('amount', String(amount));
  form.append('comprobante', new Blob([png], { type: 'image/png' }), 'comprobante.png');
  return form;
}
const me = async (token: string) => (await app.api('GET', '/auth/me', null, token)).data.user;
const archivo = (id: string, token?: string) =>
  fetch(`${app.baseUrl}/api/creditos/${id}/archivo`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

beforeAll(async () => {
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');
  await app.api('POST', '/auth/register', { email: 'otro@test.com', password: 'otro12345', firstName: 'Otro', lastName: 'Usuario' });
  O = await app.login('otro@test.com', 'otro12345');
});
afterAll(async () => {
  await app?.close();
});

describe('Comprobantes de transferencia', () => {
  let voucherId: string;

  it('muestra los datos de transferencia (incluida la cuenta)', async () => {
    const res = await app.api('GET', '/creditos/transferencia');
    expect(res.status).toBe(200);
    expect(res.data.transfer).toHaveProperty('alias');
    expect(res.data.transfer).toHaveProperty('account');
  });

  it('el usuario sube un comprobante y queda PENDIENTE', async () => {
    const res = await app.api('POST', '/creditos', comprobante(250000), U);
    expect(res.status).toBe(201);
    expect(res.data.voucher.status).toBe('PENDIENTE');
    voucherId = res.data.voucher.id;
    // Un segundo comprobante, para rechazarlo más abajo
    expect((await app.api('POST', '/creditos', comprobante(1000), U)).status).toBe(201);
  });

  it('sin monto responde 400', async () => {
    expect((await app.api('POST', '/creditos', comprobante(), U)).status).toBe(400);
  });

  it('aparece en "informes de depósitos" (/creditos/mios)', async () => {
    const res = await app.api('GET', '/creditos/mios', null, U);
    expect(res.data.vouchers.some((v: { id: string }) => v.id === voucherId)).toBe(true);
  });
});

describe('Privacidad del archivo del comprobante', () => {
  let voucherId: string;
  let fileUrl: string;

  beforeAll(async () => {
    const [v] = (await app.api('GET', '/creditos/mios', null, U)).data.vouchers.filter(
      (x: { amount: number }) => Number(x.amount) === 250000
    );
    voucherId = v.id;
    fileUrl = v.fileUrl;
  });

  it('el archivo ya no se sirve en /uploads (no es público)', async () => {
    expect((await fetch(app.baseUrl + fileUrl)).status).toBe(404);
  });

  it('el dueño ve su comprobante', async () => {
    const res = await archivo(voucherId, U);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(png)).toBe(true);
  });

  it('otro usuario no puede verlo (403) y sin login tampoco (401)', async () => {
    expect((await archivo(voucherId, O)).status).toBe(403);
    expect((await archivo(voucherId)).status).toBe(401);
  });

  it('el admin lo ve', async () => {
    expect((await archivo(voucherId, A)).status).toBe(200);
  });
});

describe('Revisión del admin', () => {
  let pendientes: { id: string; amount: number; user: { email: string } }[];
  const byAmount = (n: number) => pendientes.find((v) => Number(v.amount) === n)!;

  it('un usuario común no ve los pendientes', async () => {
    expect((await app.api('GET', '/creditos/pendientes', null, U)).status).toBe(403);
  });

  it('el admin ve los pendientes con los datos del usuario', async () => {
    const res = await app.api('GET', '/creditos/pendientes', null, A);
    pendientes = res.data.vouchers;
    expect(byAmount(250000).user.email).toBe('usuario@test.com');
  });

  it('aprobar acredita el saldo, y no se puede aprobar dos veces', async () => {
    const antes = (await me(U)).creditBalance;
    const res = await app.api('POST', `/creditos/${byAmount(250000).id}/aprobar`, null, A);
    expect(res.status).toBe(200);
    expect(res.data.voucher.status).toBe('APROBADO');
    expect((await me(U)).creditBalance).toBe(antes + 250000);
    expect((await app.api('POST', `/creditos/${byAmount(250000).id}/aprobar`, null, A)).status).toBe(400);
  });

  it('rechazar guarda el motivo y no cambia el saldo', async () => {
    const antes = (await me(U)).creditBalance;
    const res = await app.api('POST', `/creditos/${byAmount(1000).id}/rechazar`, { reason: 'El monto no coincide' }, A);
    expect(res.status).toBe(200);
    expect(res.data.voucher.rejectionReason).toBe('El monto no coincide');
    expect((await me(U)).creditBalance).toBe(antes);
  });
});

describe('Ofertas en curso', () => {
  it('una puja aparece en /compras/ofertas como "vas ganando"', async () => {
    const auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
    await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
    const lot = (await app.api('GET', `/subastas/${auctionId}`)).data.auction.lots.find((l: { sold: boolean }) => !l.sold);
    await app.api('PATCH', `/subastas/${auctionId}/lote-actual`, { lotId: lot.id }, A);

    const amount = Number(lot.currentPrice) + Number(lot.bidIncrement);
    expect((await app.api('POST', `/subastas/${auctionId}/lotes/${lot.id}/pujas`, { amount }, U)).status).toBe(201);

    const offers = (await app.api('GET', '/compras/ofertas', null, U)).data.offers;
    const mine = offers.find((o: { lotId: string }) => o.lotId === lot.id);
    expect(mine).toMatchObject({ winning: true, myBestBid: amount });
  });
});

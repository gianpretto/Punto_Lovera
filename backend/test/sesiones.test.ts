import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearPostor, startTestApp, type TestApp } from './helpers/app';

// Sesiones revocables: cambiar o recuperar la contraseña cierra las otras
// sesiones (los JWT llevan users.session_version), y el rol sale de la base.

let app: TestApp;

beforeAll(async () => {
  app = await startTestApp();
});
afterAll(async () => {
  await app?.close();
});

const me = (token: string) => app.api('GET', '/auth/me', null, token);

describe('Cambiar la contraseña con la sesión iniciada', () => {
  it('pide la actual, cierra las otras sesiones y deja seguir en esta', async () => {
    const pc = await crearPostor(app, 'sesion1@test.com', 'clave-vieja-1', 0);
    const celular = await app.login('sesion1@test.com', 'clave-vieja-1');

    const mal = await app.api('POST', '/auth/me/password', { currentPassword: 'otra', newPassword: 'clave-nueva-1' }, pc);
    expect(mal.status).toBe(400);
    const corta = await app.api('POST', '/auth/me/password', { currentPassword: 'clave-vieja-1', newPassword: 'corta' }, pc);
    expect(corta.status).toBe(400);

    const ok = await app.api('POST', '/auth/me/password', { currentPassword: 'clave-vieja-1', newPassword: 'clave-nueva-1' }, pc);
    expect(ok.status).toBe(200);
    expect((await me(ok.data.token)).status).toBe(200);
    // Las dos sesiones anteriores (incluida la del pedido) ya no valen
    expect((await me(pc)).status).toBe(401);
    expect((await me(celular)).status).toBe(401);
    // La contraseña vieja no entra, la nueva sí
    expect((await app.api('POST', '/auth/login', { email: 'sesion1@test.com', password: 'clave-vieja-1' })).status).toBe(400);
    expect((await app.api('POST', '/auth/login', { email: 'sesion1@test.com', password: 'clave-nueva-1' })).status).toBe(200);
  });

  it('una sesión cerrada tampoco entra a la sala', async () => {
    const vieja = await crearPostor(app, 'sesion2@test.com', 'clave-vieja-2', 0);
    await app.api('POST', '/auth/me/password', { currentPassword: 'clave-vieja-2', newPassword: 'clave-nueva-2' }, vieja);
    const auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
    const sala = app.room({ token: vieja });
    sala.emit('auction:join', { auctionId });
    expect((await sala.waitFor('auction:error')).code).toBe('AUTH_REQUIRED');
  });
});

describe('Recuperar la contraseña', () => {
  it('cierra todas las sesiones abiertas', async () => {
    const abierta = await crearPostor(app, 'sesion3@test.com', 'clave-vieja-3', 0);
    const token = crypto.randomBytes(32).toString('hex');
    await app.sql(
      "UPDATE users SET reset_token = $1, reset_token_expiry = now() + interval '1 hour' WHERE email = 'sesion3@test.com'",
      [crypto.createHash('sha256').update(token).digest('hex')]
    );
    expect((await app.api('POST', '/auth/reset-password', { token, password: 'clave-nueva-3' })).status).toBe(200);
    expect((await me(abierta)).status).toBe(401);
  });
});

describe('El rol sale de la base', () => {
  it('si le sacan el rol de admin, lo pierde con el token que ya tenía', async () => {
    const A = await app.login('admin@puntolovera.com', 'admin1234');
    expect((await app.api('GET', '/admin/configuracion', null, A)).status).toBe(200);
    await app.sql("UPDATE users SET role = 'USER' WHERE email = 'admin@puntolovera.com'");
    const { forgetSession } = await import('../src/services/session.service');
    const [{ id }] = await app.sql<{ id: string }>("SELECT id FROM users WHERE email = 'admin@puntolovera.com'");
    forgetSession(id); // en producción tarda como mucho 30 s (caché)
    expect((await app.api('GET', '/admin/configuracion', null, A)).status).toBe(403);
    await app.sql("UPDATE users SET role = 'ADMIN' WHERE email = 'admin@puntolovera.com'");
    forgetSession(id);
  });
});

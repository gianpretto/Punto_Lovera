import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATOS_COMPLETOS, startTestApp, type TestApp } from './helpers/app';

// SKIP_EMAIL_VERIFICATION=true (solo entornos de prueba sin SMTP)
let app: TestApp;
beforeAll(async () => {
  app = await startTestApp({ SKIP_EMAIL_VERIFICATION: 'true' });
});
afterAll(async () => {
  await app?.close();
  delete process.env.SKIP_EMAIL_VERIFICATION;
});

describe('Entorno de prueba sin validación de mail', () => {
  it('el registro deja la cuenta validada y sin token de verificación', async () => {
    const res = await app.api('POST', '/auth/register', {
      email: 'prueba@mail.com',
      password: 'clave-segura-1',
      firstName: 'Ana',
      lastName: 'Prueba',
    });
    expect(res.status).toBe(201);
    expect(res.data.user.emailVerified).toBe(true);
    const [fila] = await app.sql<{ email_verified: boolean; verification_token: string | null }>(
      "SELECT email_verified, verification_token FROM users WHERE email = 'prueba@mail.com'"
    );
    expect(fila).toEqual({ email_verified: true, verification_token: null });
  });

  it('una cuenta vieja sin validar figura como validada', async () => {
    await app.sql("UPDATE users SET email_verified = false WHERE email = 'prueba@mail.com'");
    const token = await app.login('prueba@mail.com', 'clave-segura-1');
    await app.api('PATCH', '/auth/me', DATOS_COMPLETOS, token);
    const me = await app.api('GET', '/auth/me', undefined, token);
    expect(me.data.user.emailVerified).toBe(true);
  });
});

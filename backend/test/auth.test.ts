import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, tokenDeVerificacion, type TestApp } from './helpers/app';

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(async () => {
  await app?.close();
});

describe('Auth y perfil', () => {
  let U: string;

  it('el admin del seed inicia sesión', async () => {
    const res = await app.api('POST', '/auth/login', { email: 'admin@puntolovera.com', password: 'admin1234' });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeTruthy();
  });

  it('el usuario de prueba inicia sesión con saldo 500.000', async () => {
    const res = await app.api('POST', '/auth/login', { email: 'usuario@test.com', password: 'user1234' });
    expect(res.status).toBe(200);
    expect(res.data.user.creditBalance).toBe(500000);
    U = res.data.token;
  });

  it('con contraseña incorrecta devuelve el mensaje del backend', async () => {
    const res = await app.api('POST', '/auth/login', { email: 'usuario@test.com', password: 'mal' });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe('Email o contraseña incorrectos');
  });

  it('PATCH /auth/me guarda el perfil (y "" se guarda como null)', async () => {
    const res = await app.api(
      'PATCH',
      '/auth/me',
      { phone: '1155554444', city: 'Castelar', birthDate: '1990-05-01', zipCode: '' },
      U
    );
    expect(res.status).toBe(200);
    expect(res.data.user.city).toBe('Castelar');
    expect(res.data.user.birthDate).toBe('1990-05-01');
    expect(res.data.user.zipCode).toBeNull();
    // Sin código postal el perfil queda incompleto
    expect(res.data.user.profileComplete).toBe(false);
    const restored = await app.api('PATCH', '/auth/me', { zipCode: '1712' }, U);
    expect(restored.data.user.profileComplete).toBe(true);
  });

  it('PATCH /auth/me valida el teléfono', async () => {
    const res = await app.api('PATCH', '/auth/me', { phone: 'abc' }, U);
    expect(res.status).toBe(400);
    expect(res.data.details?.[0]?.message).toBe('Solo números');
  });

  it('resend-verification no revela si el mail existe', async () => {
    const res = await app.api('POST', '/auth/resend-verification', { email: 'noexiste@x.com' });
    expect(res.status).toBe(200);
  });

  it('verificar el mail devuelve una sesión y el usuario nuevo tiene el perfil incompleto', async () => {
    const email = 'nuevo@test.com';
    const reg = await app.api('POST', '/auth/register', {
      email,
      password: 'nuevo12345',
      firstName: 'Nuevo',
      lastName: 'Postor',
    });
    expect(reg.status).toBe(201);

    // En la base solo queda el hash: el token crudo viaja en el mail
    const [{ verification_token }] = await app.sql<{ verification_token: string }>(
      'SELECT verification_token FROM users WHERE email = $1',
      [email]
    );
    expect(verification_token).toMatch(/^[0-9a-f]{64}$/);

    const token = await tokenDeVerificacion(app, email);
    const ver = await app.api('POST', '/auth/verify-email', { token });
    expect(ver.status).toBe(200);
    expect(ver.data.token).toBeTruthy();
    expect(ver.data.user.email).toBe(email);
    expect(ver.data.user.profileComplete).toBe(false);
  });
});

describe('Salud y CORS', () => {
  it('GET /health responde ok', async () => {
    const res = await app.api('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it('permite los orígenes de FRONTEND_URL (Vercel y localhost:5173)', async () => {
    for (const origin of ['https://punto-lovera.vercel.app', 'http://localhost:5173']) {
      const res = await app.api('GET', '/health', undefined, null, { Origin: origin });
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    }
  });

  it('no permite otros orígenes', async () => {
    const res = await app.api('GET', '/health', undefined, null, { Origin: 'https://malicioso.com' });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

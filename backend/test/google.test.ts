import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// "Continuar con Google". La verificación real del ID token (firma de Google)
// es de google-auth-library; acá se reemplaza por un falso que acepta
// credenciales "sub|email|nombre|apellido" y rechaza el resto.
vi.mock('../src/services/google.service', async () => {
  const { Errors } = await import('../src/utils/AppError');
  return {
    verifyGoogleCredential: async (credential: string) => {
      const [sub, email, firstName = '', lastName = ''] = credential.split('|');
      if (!sub || !email) throw Errors.unauthorized('No se pudo validar la cuenta de Google');
      return { sub, email: email.toLowerCase(), firstName, lastName };
    },
  };
});

let app: TestApp;
beforeAll(async () => {
  app = await startTestApp({ GOOGLE_CLIENT_ID: 'cliente-de-prueba.apps.googleusercontent.com' });
});
afterAll(async () => {
  await app?.close();
});

describe('Ingreso con Google', () => {
  it('informa el Client ID para mostrar el botón', async () => {
    const res = await app.api('GET', '/auth/google/config');
    expect(res.data).toEqual({ clientId: 'cliente-de-prueba.apps.googleusercontent.com' });
  });

  it('crea la cuenta la primera vez, con el mail verificado y sin contraseña', async () => {
    const res = await app.api('POST', '/auth/google', { credential: 'g-111|Nueva@Gmail.com|Ana|Pérez' });
    expect(res.status).toBe(201);
    expect(res.data.token).toEqual(expect.any(String));
    expect(res.data.user).toMatchObject({
      email: 'nueva@gmail.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      emailVerified: true,
      profileComplete: false,
    });
    const [fila] = await app.sql<{ password_hash: string | null; google_id: string }>(
      "SELECT password_hash, google_id FROM users WHERE email = 'nueva@gmail.com'"
    );
    expect(fila).toEqual({ password_hash: null, google_id: 'g-111' });

    // La segunda vez entra a la misma cuenta
    const otra = await app.api('POST', '/auth/google', { credential: 'g-111|nueva@gmail.com|Ana|Pérez' });
    expect(otra.status).toBe(200);
    expect(otra.data.user.id).toBe(res.data.user.id);

    // Sin contraseña no se puede entrar por el formulario común
    const login = await app.api('POST', '/auth/login', { email: 'nueva@gmail.com', password: 'cualquiera' });
    expect(login.status).toBe(400);
  });

  it('vincula una cuenta existente con el mismo mail y la marca verificada', async () => {
    await app.api('POST', '/auth/register', {
      email: 'juan@gmail.com',
      password: 'clave-segura-1',
      firstName: 'Juan',
      lastName: 'Gómez',
    });
    const res = await app.api('POST', '/auth/google', { credential: 'g-222|juan@gmail.com|Juancito|G' });
    expect(res.status).toBe(200);
    // Conserva sus datos y su contraseña sigue andando
    expect(res.data.user).toMatchObject({ email: 'juan@gmail.com', firstName: 'Juan', emailVerified: true });
    const login = await app.api('POST', '/auth/login', { email: 'juan@gmail.com', password: 'clave-segura-1' });
    expect(login.status).toBe(200);
  });

  it('no deja vincular un mail que ya tiene otra cuenta de Google', async () => {
    const res = await app.api('POST', '/auth/google', { credential: 'g-999|juan@gmail.com|Otro|Señor' });
    expect(res.status).toBe(409);
  });

  it('rechaza credenciales inválidas', async () => {
    expect((await app.api('POST', '/auth/google', { credential: 'basura' })).status).toBe(401);
    expect((await app.api('POST', '/auth/google', {})).status).toBe(400);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Formulario de contacto ("¿Tenés bienes para vender?" y Contactanos)
let app: TestApp;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(async () => {
  await app?.close();
});

describe('POST /contacto', () => {
  it('guarda la consulta sin necesidad de estar logueado', async () => {
    const res = await app.api('POST', '/contacto', {
      name: 'Marta Gómez',
      email: ' Marta@Mail.com ',
      message: 'Tengo una panadería completa para vender.\nEstá en Morón.',
      source: 'home',
    });
    expect(res.status).toBe(201);
    const [fila] = await app.sql<{ email: string; source: string; message: string }>(
      'SELECT email, source, message FROM contact_messages ORDER BY created_at DESC LIMIT 1'
    );
    expect(fila).toMatchObject({ email: 'marta@mail.com', source: 'home' });
    expect(fila.message).toContain('Morón');
  });

  it('valida nombre, email y mensaje', async () => {
    const res = await app.api('POST', '/contacto', { name: '', email: 'no-es-mail', message: '' });
    expect(res.status).toBe(400);
  });

  it('limita a 5 consultas por hora por IP', async () => {
    const datos = { name: 'Spam', email: 'spam@mail.com', message: 'hola' };
    const estados: number[] = [];
    for (let i = 0; i < 6; i++) estados.push((await app.api('POST', '/contacto', datos)).status);
    // el límite cuenta todos los intentos de esta IP, incluidos los de los tests anteriores
    expect(estados).toContain(429);
  });
});

describe('GET /contacto (admin)', () => {
  it('lista las consultas solo para el admin, las más nuevas primero', async () => {
    expect((await app.api('GET', '/contacto')).status).toBe(401);
    const usuario = await app.login('usuario@test.com', 'user1234');
    expect((await app.api('GET', '/contacto', undefined, usuario)).status).toBe(403);

    const admin = await app.login('admin@puntolovera.com', 'admin1234');
    const res = await app.api('GET', '/contacto', undefined, admin);
    expect(res.status).toBe(200);
    expect(res.data.messages.length).toBeGreaterThan(0);
    expect(res.data.messages[0]).toMatchObject({ email: expect.any(String), message: expect.any(String) });
    const fechas = res.data.messages.map((m: { createdAt: string }) => Date.parse(m.createdAt));
    expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
  });
});

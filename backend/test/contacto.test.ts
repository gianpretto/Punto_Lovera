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

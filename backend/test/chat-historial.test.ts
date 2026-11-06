import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Al entrar a la sala el chat trae solo lo reciente: los últimos 40 mensajes
// de los últimos 30 minutos, en orden cronológico.

let app: TestApp;

beforeAll(async () => {
  app = await startTestApp();
});
afterAll(async () => {
  await app?.close();
});

describe('Historial del chat al entrar a la sala', () => {
  it('solo los últimos 40 mensajes de la última media hora', async () => {
    const { getChatHistory } = await import('../src/services/realtime.service');
    const auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
    const [{ id: userId }] = await app.sql<{ id: string }>("SELECT id FROM users WHERE email = 'usuario@test.com'");

    // Uno de hace 2 horas (no tiene que venir) y 50 recientes
    await app.sql(
      "INSERT INTO chat_messages (id, auction_id, user_id, text, created_at) VALUES (gen_random_uuid(), $1, $2, 'viejo', now() - interval '2 hours')",
      [auctionId, userId]
    );
    for (let i = 1; i <= 50; i++) {
      await app.sql(
        "INSERT INTO chat_messages (id, auction_id, user_id, text, created_at) VALUES (gen_random_uuid(), $1, $2, $3, now() - make_interval(secs => $4))",
        [auctionId, userId, `m${i}`, 60 - i]
      );
    }

    const historial = await getChatHistory(auctionId);
    expect(historial).toHaveLength(40);
    expect(historial.map((m) => m.text)).not.toContain('viejo');
    expect(historial[0].text).toBe('m11');
    expect(historial.at(-1)?.text).toBe('m50');
  });
});

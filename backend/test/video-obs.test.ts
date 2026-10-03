import http from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Video en vivo con OBS (VIDEO_MODE=obs): clave por subasta, callback
// on_publish que manda nginx-rtmp, HLS por el proxy autenticado y
// cortar/anular la transmisión.
//
// En vez del media-server real (nginx-rtmp + OBS/ffmpeg) se levanta uno
// falso: cuando el backend acepta el on_publish, "empieza a transmitir"
// sirviendo una playlist y un segmento estáticos; /control/drop/publisher
// corta la transmisión como hace nginx.

const SECRET = 'secreto-rtmp-de-tests'; // el mismo de test/setup-env.ts
const PLAYLIST = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXTINF:2.0,\nseg0.ts\n';
const SEGMENT = Buffer.from([0x47, 0x40, 0x00, 0x10]); // bytes de un paquete MPEG-TS

const publishing = new Set<string>(); // claves "transmitiendo" en el media-server falso
const dropped: string[] = [];
const media = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://media');
  if (url.pathname === '/control/drop/publisher') {
    const name = url.searchParams.get('name') ?? '';
    dropped.push(name);
    publishing.delete(name);
    return res.end('1');
  }
  const match = /^\/hls\/([^/]+)\/(index\.m3u8|seg0\.ts)$/.exec(url.pathname);
  if (!match || !publishing.has(match[1])) {
    res.writeHead(404);
    return res.end();
  }
  if (match[2] === 'index.m3u8') {
    res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
    return res.end(PLAYLIST);
  }
  res.writeHead(200, { 'Content-Type': 'video/mp2t' });
  res.end(SEGMENT);
});

let app: TestApp;
let A: string;
let U: string;
let auctionId: string;

/** Lo que hace nginx-rtmp cuando OBS empieza a publicar: POST form al backend. */
async function onPublish(name: string, secret = SECRET) {
  const res = await fetch(`${app.baseUrl}/api/live/rtmp/publish?secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ call: 'publish', app: 'live', name, type: 'live', addr: '127.0.0.1' }),
  });
  // nginx solo acepta la transmisión con 2xx
  if (res.ok) publishing.add(name);
  return res.status;
}
const camara = (token: string) => app.api('GET', `/subastas/${auctionId}/camara`, null, token);

beforeAll(async () => {
  await new Promise<void>((resolve) => media.listen(0, '127.0.0.1', resolve));
  const mediaUrl = `http://127.0.0.1:${(media.address() as AddressInfo).port}`;
  // Antes de importar la app: env.ts lee MEDIA_SERVER_URL al cargarse
  app = await startTestApp({ MEDIA_SERVER_URL: mediaUrl });

  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');
  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
  await app.api('PATCH', `/subastas/${auctionId}`, { status: 'ACTIVA' }, A);
});
afterAll(async () => {
  await app?.close();
  await new Promise((resolve) => media.close(resolve));
});

describe('Clave de transmisión', () => {
  let key: string;

  it('modo OBS, sin clave al principio', async () => {
    const info = await camara(A);
    expect(info.status).toBe(200);
    expect(info.data).toMatchObject({ mode: 'obs', streamKey: null });
  });

  it('un usuario común no ve la clave', async () => {
    expect((await camara(U)).status).toBe(403);
  });

  it('el martillero genera la clave y la sala se entera de que hay transmisión', async () => {
    const room = app.room({ token: U });
    room.emit('auction:join', { auctionId });
    await room.waitFor('auction:state');

    expect((await app.api('POST', `/subastas/${auctionId}/camara`, {}, A)).status).toBe(201);
    const info = await camara(A);
    key = info.data.streamKey;
    expect(key).toMatch(/^camera_[0-9a-f]{64}$/);
    expect(info.data.rtmpUrl).toMatch(/^rtmp:\/\//);
    expect(info.data.receiving).toBe(false);

    await expect(room.waitFor('lot:change', (s) => Boolean(s.auction?.cameraId))).resolves.toBeTruthy();
  });

  it('generar de nuevo reusa la misma clave', async () => {
    expect((await app.api('POST', `/subastas/${auctionId}/camara`, {}, A)).status).toBe(201);
    expect((await camara(A)).data.streamKey).toBe(key);
  });

  it('on_publish rechaza secreto incorrecto, clave inventada y nombre sin prefijo', async () => {
    expect(await onPublish(key, 'secreto-malo')).toBe(403);
    expect(await onPublish('camera_inventada')).toBe(403);
    expect(await onPublish('cualquiercosa')).toBe(403);
  });

  it('on_publish acepta la clave válida (nginx deja transmitir a OBS)', async () => {
    expect(await onPublish(key)).toBe(200);
  });

  it('el usuario ve el video por el proxy autenticado', async () => {
    const pl = await app.api('GET', `/subastas/${auctionId}/vivo/hls/index.m3u8`, null, U);
    expect(pl.status).toBe(200);
    expect(String(pl.data)).toMatch(/^#EXTM3U/);
    expect(pl.headers.get('cache-control')).toBe('no-store');

    const seg = await fetch(`${app.baseUrl}/api/subastas/${auctionId}/vivo/hls/seg0.ts`, {
      headers: { Authorization: `Bearer ${U}` },
    });
    expect(seg.status).toBe(200);
    expect(seg.headers.get('content-type')).toBe('video/mp2t');
    expect(Buffer.from(await seg.arrayBuffer()).equals(SEGMENT)).toBe(true);
  });

  it('el panel del martillero muestra "recibiendo señal"', async () => {
    expect((await camara(A)).data.receiving).toBe(true);
  });

  it('detener anula la clave y corta la transmisión en el media-server', async () => {
    expect((await app.api('DELETE', `/subastas/${auctionId}/camara`, null, A)).status).toBe(200);
    expect(dropped).toContain(key);
    expect(publishing.has(key)).toBe(false);
    expect(await onPublish(key)).toBe(403);
    expect((await camara(A)).data.streamKey).toBeNull();
  });

  it('con la subasta finalizada una clave nueva ya no sirve para transmitir', async () => {
    await app.api('POST', `/subastas/${auctionId}/camara`, {}, A);
    const key2 = (await camara(A)).data.streamKey;
    expect(key2).toBeTruthy();
    expect(key2).not.toBe(key);

    await app.api('PATCH', `/subastas/${auctionId}`, { status: 'FINALIZADA' }, A);
    expect(await onPublish(key2)).toBe(403);
  });
});

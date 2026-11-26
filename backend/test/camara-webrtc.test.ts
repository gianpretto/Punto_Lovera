import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers/app';

// Cámara del martillero por WebRTC (VIDEO_MODE=webrtc): el servidor solo
// presenta al martillero con cada espectador y reenvía las señales; el
// video va directo entre navegadores (acá no hay video, solo señalización).

let app: TestApp;
let A: string;
let U: string;
let auctionId: string;

beforeAll(async () => {
  process.env.VIDEO_MODE = 'webrtc';
  app = await startTestApp();
  A = await app.login('admin@puntolovera.com', 'admin1234');
  U = await app.login('usuario@test.com', 'user1234');
  auctionId = (await app.api('GET', '/subastas')).data.auctions[0].id;
});
afterAll(async () => {
  await app?.close();
});

describe('Cámara en vivo por WebRTC', () => {
  it('martillero transmite, espectador mira y se intercambian señales', async () => {
    const martillero = app.room({ token: A });
    martillero.emit('auction:join', { auctionId });
    expect((await martillero.waitFor('auction:state')).auction.videoMode).toBe('webrtc');

    // Un usuario común no puede transmitir
    const usuario = app.room({ token: U });
    usuario.emit('auction:join', { auctionId });
    const st = await usuario.waitFor('auction:state');
    expect(st.auction.cameraOn).toBe(false);
    usuario.emit('cam:start', { auctionId });
    await usuario.waitFor('cam:error');

    martillero.emit('cam:start', { auctionId });
    const started = await martillero.waitFor('cam:started');
    expect(started.iceServers.length).toBeGreaterThan(0);
    await usuario.waitFor('cam:on');

    // El que entra después también se entera
    const tarde = app.room({ token: U });
    tarde.emit('auction:join', { auctionId });
    expect((await tarde.waitFor('auction:state')).auction.cameraOn).toBe(true);
    await tarde.waitFor('cam:on');

    usuario.emit('cam:watch', { auctionId });
    const { viewerId } = await martillero.waitFor('cam:viewer');
    expect(viewerId).toBe(usuario.socket.id);

    martillero.emit('cam:signal', { to: viewerId, description: { type: 'offer', sdp: 'x' } });
    const oferta = await usuario.waitFor('cam:signal');
    expect(oferta).toMatchObject({ from: martillero.socket.id, description: { type: 'offer' } });

    usuario.emit('cam:signal', { to: oferta.from, description: { type: 'answer', sdp: 'y' } });
    expect((await martillero.waitFor('cam:signal')).from).toBe(viewerId);

    // Alguien que no entró a la sala no puede mirar ni mandarle señales a nadie
    const afuera = app.room({ token: U });
    await new Promise<void>((r) => afuera.socket.on('connect', () => r()));
    afuera.emit('cam:watch', { auctionId });
    afuera.emit('cam:signal', { to: martillero.socket.id, candidate: { candidate: 'z' } });
    afuera.emit('cam:signal', { to: viewerId, candidate: { candidate: 'z' } });
    await expect(martillero.waitFor('cam:viewer', () => true, 400)).rejects.toThrow(/Timeout/);
    await expect(martillero.waitFor('cam:signal', () => true, 100)).rejects.toThrow(/Timeout/);
    await expect(usuario.waitFor('cam:signal', () => true, 100)).rejects.toThrow(/Timeout/);

    // Un espectador no puede mandarle señales a otro espectador
    tarde.emit('cam:signal', { to: viewerId, candidate: { candidate: 'z' } });
    await expect(usuario.waitFor('cam:signal', () => true, 300)).rejects.toThrow(/Timeout/);

    // El espectador se va: el martillero se entera
    tarde.socket.disconnect();
    await martillero.waitFor('cam:viewer-left', (p) => p.viewerId);

    // El martillero corta (o se le cierra el panel): la sala se entera
    martillero.socket.disconnect();
    await usuario.waitFor('cam:off');
  });

  it('con la cámara del navegador, las rutas de OBS/rtsp no se usan', async () => {
    expect((await app.api('POST', `/subastas/${auctionId}/camara`, {}, A)).status).toBe(400);
  });
});

import type { AddressInfo } from 'net';
import { io as ioClient, Socket } from 'socket.io-client';

/**
 * Levanta la app (Express + Socket.io) en un puerto efímero contra la base
 * de PGlite, vaciada y con el seed cargado. Se llama en el beforeAll de cada
 * archivo.
 *
 * La app se importa acá adentro (import dinámico) y no arriba del archivo:
 * src/config/env.ts lee process.env al importarse, así que primero se setean
 * las variables (test/setup-env.ts y `env` de este helper) y recién después
 * se carga el código del backend. Vitest aísla los módulos por archivo, así
 * que cada archivo tiene su propia instancia de la app.
 */
export async function startTestApp(env: Record<string, string> = {}) {
  Object.assign(process.env, env);

  const { createServer } = await import('../../src/createServer');
  const { pool } = await import('../../src/config/db');
  const { seedDatabase } = await import('../../src/seed/seed-data');

  // PGlite tiene un único backend y pglite-socket encola los mensajes del
  // protocolo de a uno: con varias conexiones a la vez, los Parse/Bind/
  // Execute de una se mezclan con los de otra (comparten el statement y el
  // portal sin nombre) y fallan con "portal does not exist" o "bind message
  // supplies N parameters". Por eso en los tests el Pool de la app usa UNA
  // sola conexión (pg-pool lee `options.max` en cada pedido, así que alcanza
  // con cambiarlo antes de la primera consulta). Las transacciones de la app
  // usan siempre `tx`, así que no hay riesgo de que se bloquee a sí misma.
  (pool as unknown as { options: { max: number } }).options.max = 1;

  /** Consulta SQL directa (para preparar casos que la API no permite). */
  async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
    const { rows } = await pool.query(text, params);
    return rows as T[];
  }

  // Datos limpios: vacía las tablas de la app (no el historial de
  // migraciones, que vive en el esquema "drizzle") y carga el seed
  const tables = await sql<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  await sql(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await seedDatabase();

  const { server, io } = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const sockets: Socket[] = [];

  return {
    baseUrl,
    sql,
    api: makeApi(baseUrl),
    login: async (email: string, password: string) => {
      const res = await makeApi(baseUrl)('POST', '/auth/login', { email, password });
      if (res.status !== 200) throw new Error(`login de ${email} falló (${res.status})`);
      return res.data.token as string;
    },
    /** Cliente de la sala en vivo (se desconecta solo en close()). */
    room: (auth: { token?: string; pase?: string } = {}) => {
      const client = connectRoom(baseUrl, auth);
      sockets.push(client.socket);
      return client;
    },
    close: async () => {
      for (const s of sockets) s.disconnect();
      // io.close() también cierra el http server
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await pool.end();
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;

export type ApiResponse = { status: number; data: any; headers: Headers };

/** fetch contra /api: JSON o FormData, con JWT opcional. */
function makeApi(baseUrl: string) {
  return async function api(
    method: string,
    path: string,
    body?: unknown,
    token?: string | null,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse> {
    const isForm = body instanceof FormData;
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // no era JSON (ej: playlist HLS): queda como texto
    }
    return { status: res.status, data, headers: res.headers };
  };
}

/**
 * Socket.io con buffer de eventos: `waitFor` devuelve el primer evento que
 * coincida (ya recibido o por llegar) y lo consume, con un timeout acotado
 * en vez de sleeps.
 */
function connectRoom(baseUrl: string, auth: { token?: string; pase?: string }) {
  const socket = ioClient(baseUrl, { auth, transports: ['websocket'], forceNew: true, reconnection: false });

  type Pred = (payload: any) => boolean;
  const received: { ev: string; payload: unknown }[] = [];
  const waiters: { ev: string; pred: Pred; resolve: (p: any) => void }[] = [];

  socket.onAny((ev: string, payload: unknown) => {
    const i = waiters.findIndex((w) => w.ev === ev && w.pred(payload));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(payload);
    else received.push({ ev, payload });
  });

    function waitFor(ev: string, pred: Pred = () => true, ms = 5000): Promise<any> {
    const i = received.findIndex((e) => e.ev === ev && pred(e.payload));
    if (i >= 0) return Promise.resolve(received.splice(i, 1)[0].payload);
    return new Promise((resolve, reject) => {
      const waiter = {
        ev,
        pred,
        resolve: (p: unknown) => {
          clearTimeout(timer);
          resolve(p);
        },
      };
      const timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error(`Timeout esperando el evento "${ev}" (${ms}ms)`));
      }, ms);
      waiters.push(waiter);
    });
  }

  return {
    socket,
    waitFor,
    emit: (ev: string, payload: unknown) => socket.emit(ev, payload),
  };
}

/** Completa los datos personales (sin esto no se puede pujar). */
export const DATOS_COMPLETOS = {
  phone: '1144443333',
  dni: '28999888',
  address: 'Calle 1',
  city: 'Moron',
  province: 'Buenos Aires',
  zipCode: '1708',
};

/** Registra un usuario, le carga saldo directo en la base y completa sus datos. */
export async function crearPostor(app: TestApp, email: string, password: string, saldo: number) {
  await app.api('POST', '/auth/register', { email, password, firstName: 'Postor', lastName: 'Dos' });
  await app.sql('UPDATE users SET credit_balance = $1 WHERE email = $2', [saldo, email]);
  const token = await app.login(email, password);
  await app.api('PATCH', '/auth/me', DATOS_COMPLETOS, token);
  return token;
}

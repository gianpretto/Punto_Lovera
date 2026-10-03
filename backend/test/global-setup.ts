import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Postgres embebido (PGlite, en memoria) que habla el protocolo de Postgres
 * por TCP, así el backend se conecta con el mismo driver `pg` de producción.
 * Sin Docker ni servicios externos: corre igual en la compu y en CI.
 */
export default async function setup(project: TestProject) {
  const pglite = await PGlite.create();
  const server = new PGLiteSocketServer({
    db: pglite,
    host: '127.0.0.1',
    port: 0, // puerto libre que elige el sistema (no choca con otros procesos)
    // El default es 1 conexión: el Pool de la app abre varias a la vez
    maxConnections: 50,
  });
  await server.start();

  const databaseUrl = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;

  // Mismas migraciones .sql que corre producción (src/db/migrate.ts)
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL('../src/db/migrations', import.meta.url)),
  });
  await pool.end();

  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await server.stop();
    await pglite.close();
  };
}

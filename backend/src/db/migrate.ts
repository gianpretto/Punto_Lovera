import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import 'dotenv/config';

// Aplica las migraciones pendientes (las mismas .sql que genera drizzle-kit).
// Corre en cada deploy antes de levantar el server (npm run start:prod), así
// no depende de drizzle-kit (devDependency) en producción.
//
// MIGRATIONS_DATABASE_URL es opcional: en Neon conviene la conexión directa
// (sin "-pooler") para migrar; si no está, usa DATABASE_URL.

async function main() {
  const connectionString = process.env.MIGRATIONS_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL');

  const pool = new Pool({ connectionString, max: 1 });
  // Funciona igual desde src/ (tsx) que desde dist/ (node): las .sql viven en src/
  const migrationsFolder = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');

  console.log('Aplicando migraciones...');
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('Migraciones al día');
  await pool.end();
}

main().catch((err) => {
  console.error('Error aplicando migraciones:', err);
  process.exit(1);
});

import { defineConfig } from 'vitest/config';

// Tests de integración: API + Socket.io reales contra un Postgres embebido
// (PGlite) que levanta test/global-setup.ts. Las variables de entorno de
// prueba se cargan en test/setup-env.ts.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    // Todos los archivos comparten la misma base (y cada uno la vacía al
    // empezar), así que corren de a uno. Dentro de cada archivo los tests son
    // pasos de un mismo flujo y también van en orden.
    fileParallelism: false,
    pool: 'forks',
    // Los console.log de la app (mails simulados, etc.) solo se muestran si
    // el test falla
    silent: 'passed-only',
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});

import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { settings } from '../db/schema';
import { env } from '../config/env';

/**
 * Configuración general que edita el admin (tabla settings, clave → JSON).
 *
 * - "creditos": cómo se garantizan las ofertas (decisión del cliente, nov 2026):
 *   - CREDITO: hay que cargar crédito antes y se oferta hasta ese monto
 *     (lo que lidera queda reservado y al adjudicar se descuenta).
 *   - SIN_CREDITO: se oferta sin crédito; el pago se arregla de palabra
 *     fuera de la plataforma (es como van a arrancar).
 *   - GARANTIA (híbrido): alcanza con tener crédito por un % de la oferta;
 *     se reserva ese % y al adjudicar se descuenta como seña.
 * - "transferencia": datos que se muestran en /creditos para transferir.
 *   Si nunca se editaron, se usan las variables TRANSFER_* de Railway.
 */

export type ModoCredito = 'CREDITO' | 'SIN_CREDITO' | 'GARANTIA';

export interface ConfigCreditos {
  modo: ModoCredito;
  /** Solo en GARANTIA: % de la oferta que tiene que estar cubierto (1-100) */
  porcentajeGarantia: number;
}

export interface DatosTransferencia {
  alias: string;
  cbu: string;
  holder: string;
  cuit: string;
  account: string;
}

const CREDITOS_DEFAULT: ConfigCreditos = { modo: 'CREDITO', porcentajeGarantia: 10 };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

// exec: dentro de una transacción hay que leer con `tx` (con una sola
// conexión, como en los tests, usar `db` ahí adentro se trabaría)
async function leer<T>(key: string, exec: Executor = db): Promise<T | undefined> {
  const [row] = await exec.select().from(settings).where(eq(settings.key, key));
  return row?.value as T | undefined;
}

async function guardar(key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function getCreditConfig(exec: Executor = db): Promise<ConfigCreditos> {
  return { ...CREDITOS_DEFAULT, ...(await leer<Partial<ConfigCreditos>>('creditos', exec)) };
}

export async function setCreditConfig(config: ConfigCreditos) {
  await guardar('creditos', config);
  return config;
}

/**
 * Qué parte del precio de una oferta tiene que estar cubierta por crédito
 * (y queda reservada / se descuenta al adjudicar): 1, el %, o 0.
 */
export function factorDeCredito(config: ConfigCreditos) {
  if (config.modo === 'SIN_CREDITO') return 0;
  if (config.modo === 'GARANTIA') return config.porcentajeGarantia / 100;
  return 1;
}

export async function getTransferInfo(): Promise<DatosTransferencia> {
  const guardados = await leer<Partial<DatosTransferencia>>('transferencia');
  return {
    alias: env.transfer.alias,
    cbu: env.transfer.cbu,
    holder: env.transfer.holder,
    cuit: env.transfer.cuit,
    account: env.transfer.account,
    ...guardados,
  };
}

export async function setTransferInfo(datos: DatosTransferencia) {
  await guardar('transferencia', datos);
  return datos;
}

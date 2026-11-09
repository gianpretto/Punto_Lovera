import { useEffect, useState } from 'react';
import { api } from './api';

// Configuración general que elige el admin (/admin/configuracion).
// Modo de créditos: cómo se garantizan las ofertas.
//  - CREDITO: hay que cargar crédito antes y se oferta hasta ese monto.
//  - SIN_CREDITO: se oferta sin crédito; el pago se arregla con Punto Lovera.
//  - GARANTIA: alcanza con tener crédito por un % de la oferta.

export type ModoCredito = 'CREDITO' | 'SIN_CREDITO' | 'GARANTIA';

export interface ConfigCreditos {
  modo: ModoCredito;
  porcentajeGarantia: number;
}

export interface DatosTransferencia {
  alias: string;
  cbu: string;
  holder: string;
  cuit: string;
  account: string;
}

// Se pide una vez por carga de la app (cambia muy de vez en cuando)
let cache: Promise<ConfigCreditos> | null = null;

export function getConfigCreditos(): Promise<ConfigCreditos> {
  if (!cache) {
    cache = api
      .get<{ creditos: ConfigCreditos }>('/config')
      .then((r) => r.creditos)
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

/** Después de que el admin la cambia, que el resto de la app use la nueva */
export function olvidarConfigCreditos() {
  cache = null;
}

/** null mientras carga (o si falló: se asume el comportamiento de siempre, CREDITO) */
export function useConfigCreditos(): ConfigCreditos | null {
  const [config, setConfig] = useState<ConfigCreditos | null>(null);
  useEffect(() => {
    let vivo = true;
    getConfigCreditos().then(
      (c) => vivo && setConfig(c),
      () => vivo && setConfig({ modo: 'CREDITO', porcentajeGarantia: 10 })
    );
    return () => {
      vivo = false;
    };
  }, []);
  return config;
}

/** CUIT/CUIL: 11 dígitos con el verificador correcto (misma regla que el backend) */
export function cuitValido(v: string) {
  if (!/^\d{11}$/.test(v)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(v[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(v[10]);
}

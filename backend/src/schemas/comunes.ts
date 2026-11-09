import { z } from 'zod';

// Validaciones compartidas por los formularios (largos máximos y formatos).
// Las mismas reglas están en el front (frontend-react/src/services/validaciones.ts):
// si se cambia una, cambiar la otra.

export const LARGOS = {
  nombre: 60,
  email: 254,
  direccion: 120,
  ciudad: 60,
  provincia: 60,
  mensaje: 2000,
  motivo: 500,
  alias: 20,
  titular: 100,
  textoCorto: 200,
  titulo: 120,
  descripcion: 5000,
} as const;

/** Nombre o apellido: letras (con tildes), espacios, apóstrofo, punto y guion */
export const nombrePersona = (campo: string) =>
  z
    .string({ error: `Falta el ${campo}` })
    .trim()
    .min(1, `Falta el ${campo}`)
    .max(LARGOS.nombre, `El ${campo} puede tener como máximo ${LARGOS.nombre} caracteres`)
    .regex(/^\p{L}[\p{L}\s'.-]*$/u, `El ${campo} solo puede tener letras`);

/** Texto libre con largo máximo (trim) */
export const texto = (max: number, nombre = 'El texto') =>
  z.string().trim().max(max, `${nombre} puede tener como máximo ${max} caracteres`);

/** CUIT/CUIL: 11 dígitos con el dígito verificador correcto */
export function cuitValido(v: string) {
  if (!/^\d{11}$/.test(v)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(v[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(v[10]);
}

const sinSeparadores = (v: string) => v.replace(/[\s.-]/g, '');

/** CUIT/CUIL (se aceptan guiones/puntos al pegarlo; se guarda solo con dígitos) */
export const cuit = z
  .string()
  .transform(sinSeparadores)
  .pipe(z.string().refine(cuitValido, 'CUIT/CUIL inválido: son 11 números (ej. 20-12345678-6)'));

/** DNI (7 u 8 dígitos) o CUIL (11 dígitos válidos) */
export const dniOCuil = z
  .string()
  .transform(sinSeparadores)
  .pipe(
    z
      .string()
      .refine(
        (v) => /^\d{7,8}$/.test(v) || cuitValido(v),
        'Ingresá tu DNI (7 u 8 números) o tu CUIL (11 números)'
      )
  );

/** Código de área argentino sin el 0 (2 a 4 dígitos, ej. 11, 221, 2944) */
export const codigoArea = z
  .string()
  .trim()
  .regex(/^[1-9]\d{1,3}$/, 'Código de área inválido: va sin el 0 (ej. 11, 221, 351)');

/** Número de celular sin el 15 (6 a 8 dígitos); área + número = 10 dígitos */
export const numeroCelular = z
  .string()
  .transform(sinSeparadores)
  .pipe(z.string().regex(/^\d{6,8}$/, 'Número inválido: va sin el 15 (ej. 12345678)'));

/** Código postal: 4 dígitos o el CPA nuevo (ej. B1878ABC) */
export const codigoPostal = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^([A-Z]\d{4}[A-Z]{3}|\d{4})$/, 'Código postal inválido (ej. 1878 o B1878ABC)');

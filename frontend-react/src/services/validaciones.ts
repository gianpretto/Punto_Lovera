// Validaciones de los formularios: las mismas reglas que el backend
// (backend/src/schemas/comunes.ts). Si se cambia una, cambiar la otra.
// Cada función devuelve el mensaje de error, o undefined si está bien.

export const LARGOS = {
  nombre: 60,
  email: 254,
  password: 72,
  direccion: 120,
  ciudad: 60,
  provincia: 60,
  cp: 8,
  mensaje: 2000,
  motivo: 500,
  alias: 20,
  titular: 100,
  textoCorto: 200,
  titulo: 120,
  descripcion: 5000,
  pase: 80,
  cbu: 26, // 22 dígitos + espacios/guiones al pegarlo
  cuit: 13, // 11 dígitos + 2 guiones
  dni: 13,
  area: 4,
  celular: 8,
  telefono: 20,
  codigo: 6,
  monto: 13,
} as const;

export const MONTO_MAXIMO = 9_999_999_999;

type Resultado = string | undefined;

const sinSeparadores = (v: string) => v.replace(/[\s.-]/g, '');

/** Obligatorio: texto vacío → "Completá este dato." */
export function requerido(v: string, mensaje = 'Completá este dato.'): Resultado {
  return v.trim() === '' ? mensaje : undefined;
}

/** Largo máximo (por si se pega algo más largo que el maxLength) */
export function largoMaximo(v: string, max: number): Resultado {
  return v.trim().length > max ? `Puede tener como máximo ${max} caracteres.` : undefined;
}

/** Nombre o apellido: letras (con tildes), espacios, apóstrofo, punto y guion */
export function nombrePersona(v: string, campo = 'nombre'): Resultado {
  const t = v.trim();
  if (!t) return `Completá tu ${campo}.`;
  if (t.length > LARGOS.nombre) return `El ${campo} puede tener como máximo ${LARGOS.nombre} caracteres.`;
  if (!/^\p{L}[\p{L}\s'.-]*$/u.test(t)) return `El ${campo} solo puede tener letras.`;
  return undefined;
}

export function email(v: string): Resultado {
  const t = v.trim();
  if (!t) return 'Completá tu email.';
  if (t.length > LARGOS.email) return 'El email es demasiado largo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'Ingresá un email válido.';
  return undefined;
}

/** Contraseña nueva: 8 a 72 caracteres (bcrypt solo usa 72 bytes) */
export function passwordNueva(v: string): Resultado {
  if (v.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (new TextEncoder().encode(v).length > LARGOS.password) return 'La contraseña puede tener como máximo 72 caracteres.';
  return undefined;
}

/** CUIT/CUIL: 11 dígitos con el dígito verificador correcto */
export function cuitValido(v: string): boolean {
  const d = sinSeparadores(v);
  if (!/^\d{11}$/.test(d)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(d[10]);
}

export function cuit(v: string): Resultado {
  if (!v.trim()) return 'Completá el CUIT / CUIL.';
  return cuitValido(v) ? undefined : 'CUIT / CUIL inválido: son 11 números (ej. 20-12345678-6).';
}

/** DNI (7 u 8 dígitos) o CUIL (11 dígitos válidos) */
export function dniOCuil(v: string): Resultado {
  const d = sinSeparadores(v);
  if (!d) return 'Completá tu DNI o CUIL.';
  if (/^\d{7,8}$/.test(d) || cuitValido(d)) return undefined;
  return 'Ingresá tu DNI (7 u 8 números) o tu CUIL (11 números).';
}

/** Código de área argentino sin el 0 (ej. 11, 221, 2944) */
export function codigoArea(v: string): Resultado {
  if (!v.trim()) return 'Completá el código de área.';
  return /^[1-9]\d{1,3}$/.test(v.trim()) ? undefined : 'Va sin el 0 (ej. 11, 221, 351).';
}

/** Número de celular sin el 15; código de área + número = 10 dígitos */
export function numeroCelular(numero: string, area: string): Resultado {
  const n = sinSeparadores(numero);
  if (!n) return 'Completá el número.';
  if (!/^\d{6,8}$/.test(n)) return 'Va sin el 15 (ej. 12345678).';
  if (/^[1-9]\d{1,3}$/.test(area.trim()) && area.trim().length + n.length !== 10) {
    return 'Código de área + número tienen que sumar 10 números (ej. 11 + 12345678).';
  }
  return undefined;
}

/** Código postal: 4 dígitos o el CPA nuevo (ej. B1878ABC). Opcional. */
export function codigoPostal(v: string): Resultado {
  const t = v.trim().toUpperCase();
  if (!t) return undefined;
  return /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/.test(t) ? undefined : 'Código postal inválido (ej. 1878 o B1878ABC).';
}

/** CBU: 22 dígitos (se aceptan espacios/guiones al pegarlo) */
export function cbu(v: string): Resultado {
  const d = v.replace(/[\s-]/g, '');
  if (!d) return 'Completá el CBU / CVU.';
  return /^\d{22}$/.test(d) ? undefined : 'El CBU / CVU tiene que tener 22 números.';
}

/** Alias de CBU: 6 a 20 caracteres (letras, números, punto y guion). Opcional. */
export function aliasCbu(v: string): Resultado {
  const t = v.trim();
  if (!t) return undefined;
  return /^[A-Za-z0-9.-]{6,20}$/.test(t) ? undefined : 'El alias tiene de 6 a 20 caracteres (letras, números, punto o guion).';
}

/** Monto en pesos: mayor a 0 y hasta 9.999.999.999 */
export function monto(v: string | number, nombre = 'El monto'): Resultado {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'));
  if (String(v).trim() === '' || !Number.isFinite(n)) return `Completá ${nombre.toLowerCase()}.`;
  if (n <= 0) return `${nombre} tiene que ser mayor a 0.`;
  if (n > MONTO_MAXIMO) return `${nombre} es demasiado grande.`;
  return undefined;
}

/** Primer error de una lista de validaciones (o undefined) */
export function primero(...resultados: Resultado[]): Resultado {
  return resultados.find(Boolean);
}

/** Consulta de contacto (Contactanos y "¿Tenés bienes para vender?") */
export function consulta(d: { nombre: string; email: string; mensaje: string }): Resultado {
  return primero(
    requerido(d.nombre, 'Completá tu nombre.'),
    d.nombre.trim().length > 120 ? 'El nombre es demasiado largo.' : undefined,
    email(d.email),
    requerido(d.mensaje, 'Contanos qué querés consultar.'),
    largoMaximo(d.mensaje, LARGOS.mensaje)
  );
}

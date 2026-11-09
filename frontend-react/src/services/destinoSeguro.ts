/**
 * Valida el `?volver=` de login/registro/datos: solo rutas de este sitio.
 * Ojo con "/\evil.com": el navegador trata "\" como "/", así que equivale a
 * "//evil.com" (otro sitio) y React Router termina haciendo un redirect
 * completo. Por eso se rechaza cualquier "\" y el "//" del principio.
 */
export function destinoSeguro(volver: string | null | undefined, porDefecto = '/') {
  if (!volver || !volver.startsWith('/') || volver.startsWith('//') || volver.includes('\\')) return porDefecto;
  // Caracteres de control (ej. tab o salto de línea, que el navegador ignora)
  if (/[\u0000-\u001f\u007f]/.test(volver)) return porDefecto;
  return volver;
}

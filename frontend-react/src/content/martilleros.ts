// Martilleros de Punto Lovera. El backend no guarda martillero por subasta:
// se muestran los dos en Home, Todas las subastas y la sala en vivo.
// TODO: cargar las matrículas cuando el cliente las pase (vacías no se muestran).
export const MARTILLEROS = [
  { nombre: 'Gonzalo Lovera', matricula: '' },
  { nombre: 'Emiliano Lovera', matricula: '' },
];

/** "Gonzalo Lovera · Emiliano Lovera" */
export const NOMBRES_MARTILLEROS = MARTILLEROS.map((m) => m.nombre).join(' · ');

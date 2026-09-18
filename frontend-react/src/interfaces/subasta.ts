export interface Countdown {
  d: string | number;
  h: string | number;
  m: string | number;
  s: string | number;
}

export interface Subasta {
  id?: string | number;
  estado?: string;
  titulo: string;
  ubicacion: string;
  descripcion: string;
  fecha: string;
  hora: string;
  countdown?: Countdown;
}

export function makeCountdown(d: number, h: number, m: number, s: number): Countdown {
  const pad = (n: number) => String(n).padStart(2, '0');
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
}

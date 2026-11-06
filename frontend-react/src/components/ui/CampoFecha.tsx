import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import campoStyles from './Campo.module.scss';
import styles from './CampoFecha.module.scss';

// Campo de fecha con el estilo del rediseño (en lugar del calendario nativo
// del navegador): se puede escribir "dd/mm/aaaa" o elegirla en un calendario
// propio con selector de mes y de año (cómodo para fechas de nacimiento).
// El valor que entra y sale es ISO "aaaa-mm-dd" (lo que espera el backend).

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  etiqueta: string;
  /** "aaaa-mm-dd" o "" */
  value: string;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  error?: string;
  id?: string;
  className?: string;
  /** Año más viejo del selector (default 1920) */
  desdeAnio?: number;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const aIso = (a: number, m: number, d: number) => `${a}-${dosDigitos(m + 1)}-${dosDigitos(d)}`;

function deIso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { a: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

const isoATexto = (iso: string) => {
  const f = deIso(iso);
  return f ? `${dosDigitos(f.d)}/${dosDigitos(f.m + 1)}/${f.a}` : '';
};

/** "dd/mm/aaaa" de una fecha real entre `desdeAnio` y hoy → ISO; si no, null */
function textoAIso(texto: string, desdeAnio: number) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const d = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const a = Number(m[3]);
  const fecha = new Date(a, mes, d);
  if (fecha.getFullYear() !== a || fecha.getMonth() !== mes || fecha.getDate() !== d) return null;
  if (a < desdeAnio || fecha > new Date()) return null;
  return aIso(a, mes, d);
}

/** Pone las barras solas mientras se escribe: 28081998 → 28/08/1998 */
function conBarras(texto: string) {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

export default function CampoFecha({ etiqueta, value, onChange, onBlur, error, id, className, desdeAnio = 1920 }: Props) {
  const idAuto = useId();
  const idCampo = id ?? idAuto;
  const idError = `${idCampo}-error`;
  const idCalendario = `${idCampo}-calendario`;

  const hoy = new Date();
  const hastaAnio = hoy.getFullYear();
  const elegida = deIso(value);

  const [texto, setTexto] = useState(isoATexto(value));
  // Lo escrito no es una fecha válida (se avisa al salir del campo)
  const [errorLocal, setErrorLocal] = useState('');
  const errorVisible = error || errorLocal;
  const [abierto, setAbierto] = useState(false);
  // Mes que se está mirando en el calendario
  const [vista, setVista] = useState(() => ({
    a: elegida?.a ?? hastaAnio - 30,
    m: elegida?.m ?? 0,
  }));
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  // Si el valor cambia de afuera (ej: llegan los datos del usuario)
  useEffect(() => {
    setTexto(isoATexto(value));
  }, [value]);

  // Cerrar con click afuera
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const abrir = () => {
    const f = deIso(value);
    if (f) setVista({ a: f.a, m: f.m });
    setAbierto((v) => !v);
  };

  const elegir = (a: number, m: number, d: number) => {
    const iso = aIso(a, m, d);
    onChange(iso);
    setTexto(isoATexto(iso));
    setErrorLocal('');
    setAbierto(false);
    onBlur?.();
    botonRef.current?.focus();
  };

  const moverMes = (delta: number) =>
    setVista(({ a, m }) => {
      const nuevo = new Date(a, m + delta, 1);
      return { a: nuevo.getFullYear(), m: nuevo.getMonth() };
    });

  const escribir = (valor: string) => {
    const t = conBarras(valor);
    setTexto(t);
    setErrorLocal('');
    const iso = textoAIso(t, desdeAnio);
    if (iso) onChange(iso);
    else if (t === '') onChange('');
  };

  const alSalir = () => {
    if (texto && !textoAIso(texto, desdeAnio)) {
      setErrorLocal(`Fecha inválida: usá dd/mm/aaaa, entre ${desdeAnio} y hoy`);
      // Que no quede guardada en silencio la fecha anterior
      onChange('');
    }
    onBlur?.();
  };

  const teclaCalendario = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setAbierto(false);
      botonRef.current?.focus();
    }
  };

  // Celdas del mes: arranca el lunes; huecos vacíos antes del día 1
  const celdas = useMemo(() => {
    const primero = new Date(vista.a, vista.m, 1);
    const huecos = (primero.getDay() + 6) % 7;
    const cantidad = new Date(vista.a, vista.m + 1, 0).getDate();
    return [...Array(huecos).fill(null), ...Array.from({ length: cantidad }, (_, i) => i + 1)] as (number | null)[];
  }, [vista]);

  const anios = useMemo(
    () => Array.from({ length: hastaAnio - desdeAnio + 1 }, (_, i) => hastaAnio - i),
    [hastaAnio, desdeAnio],
  );

  const esFuturo = (d: number) => new Date(vista.a, vista.m, d) > hoy;
  const esHoy = (d: number) =>
    vista.a === hoy.getFullYear() && vista.m === hoy.getMonth() && d === hoy.getDate();
  const esElegida = (d: number) => elegida?.a === vista.a && elegida.m === vista.m && elegida.d === d;
  const enElUltimoMes = vista.a === hastaAnio && vista.m === hoy.getMonth();
  const enElPrimerMes = vista.a === desdeAnio && vista.m === 0;

  return (
    <div
      ref={contenedorRef}
      className={[campoStyles.campo, campoStyles.claro, errorVisible ? campoStyles.invalido : '', styles.fecha, className ?? ''].join(' ')}
    >
      <label htmlFor={idCampo}>{etiqueta}</label>
      <div className={styles.fila}>
        <input
          id={idCampo}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="dd/mm/aaaa"
          value={texto}
          onChange={(e) => escribir(e.target.value)}
          onBlur={alSalir}
          aria-invalid={errorVisible ? true : undefined}
          aria-describedby={errorVisible ? idError : undefined}
        />
        <button
          ref={botonRef}
          type="button"
          className={styles.abrir}
          onClick={abrir}
          aria-label="Elegir la fecha en el calendario"
          aria-expanded={abierto}
          aria-controls={idCalendario}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="1" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
      </div>

      {abierto && (
        <div id={idCalendario} className={styles.calendario} role="dialog" aria-label={`Calendario: ${etiqueta}`} onKeyDown={teclaCalendario}>
          <div className={styles.cabecera}>
            <button
              type="button"
              className={styles.flecha}
              onClick={() => moverMes(-1)}
              disabled={enElPrimerMes}
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <select
              className={styles.selector}
              value={vista.m}
              onChange={(e) => setVista((v) => ({ ...v, m: Number(e.target.value) }))}
              aria-label="Mes"
            >
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i}>
                  {nombre}
                </option>
              ))}
            </select>
            <select
              className={styles.selector}
              value={vista.a}
              onChange={(e) => setVista((v) => ({ ...v, a: Number(e.target.value) }))}
              aria-label="Año"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.flecha}
              onClick={() => moverMes(1)}
              disabled={enElUltimoMes}
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div className={styles.grilla} role="grid">
            {DIAS.map((d) => (
              <span key={d} className={styles.diaSemana} aria-hidden="true">
                {d}
              </span>
            ))}
            {celdas.map((d, i) =>
              d === null ? (
                <span key={`h${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  className={[styles.dia, esElegida(d) ? styles.elegido : '', esHoy(d) ? styles.hoy : ''].join(' ')}
                  onClick={() => elegir(vista.a, vista.m, d)}
                  disabled={esFuturo(d)}
                  aria-label={`${d} de ${MESES[vista.m].toLowerCase()} de ${vista.a}`}
                  aria-pressed={esElegida(d)}
                >
                  {d}
                </button>
              ),
            )}
          </div>

          <div className={styles.pie}>
            <button
              type="button"
              className={styles.enlace}
              onClick={() => {
                onChange('');
                setTexto('');
                setErrorLocal('');
                setAbierto(false);
              }}
            >
              Borrar
            </button>
            <button type="button" className={styles.enlace} onClick={() => setAbierto(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {errorVisible && (
        <p id={idError} className={campoStyles.error}>
          {errorVisible}
        </p>
      )}
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import {
  cuitValido,
  olvidarConfigCreditos,
  type ConfigCreditos,
  type DatosTransferencia,
  type ModoCredito,
} from '../../services/config';
import panel from '../PanelMartillero/PanelMartillero.module.scss';
import styles from './AdminConfiguracion.module.scss';

// /admin/configuracion (solo ADMIN, pantalla interna sin diseño): cómo se
// garantizan las ofertas (con crédito, sin crédito o garantía de un %) y los
// datos para transferir que se muestran en /creditos.

const MODOS: { valor: ModoCredito; titulo: string; ayuda: string }[] = [
  {
    valor: 'CREDITO',
    titulo: 'Con crédito (cargar antes de ofertar)',
    ayuda: 'Cada usuario oferta hasta el crédito que cargó. Al adjudicar se descuenta el total.',
  },
  {
    valor: 'SIN_CREDITO',
    titulo: 'Sin crédito (el pago se arregla aparte)',
    ayuda: 'Cualquier usuario con sus datos completos puede ofertar. El pago se coordina fuera de la web.',
  },
  {
    valor: 'GARANTIA',
    titulo: 'Híbrido: garantía de un % de la oferta',
    ayuda: 'Para ofertar alcanza con tener crédito por ese % de la oferta. Al adjudicar se descuenta como seña.',
  },
];

const VACIO: DatosTransferencia = { alias: '', cbu: '', holder: '', cuit: '', account: '' };

// Largos máximos de cada campo (los mismos que valida el backend)
const LARGO: Record<keyof DatosTransferencia, number> = { alias: 20, cbu: 26, holder: 100, cuit: 13, account: 200 };

const sinSeparadores = (v: string) => v.replace(/[\s.-]/g, '');

function erroresTransferencia(d: DatosTransferencia): Record<keyof DatosTransferencia, string> {
  const alias = d.alias.trim();
  const cbu = sinSeparadores(d.cbu);
  const cuit = sinSeparadores(d.cuit);
  return {
    alias: alias && !/^[A-Za-z0-9.-]{6,20}$/.test(alias) ? 'De 6 a 20 letras, números, puntos o guiones.' : '',
    cbu: cbu && !/^\d{22}$/.test(cbu) ? 'El CBU/CVU tiene 22 números.' : '',
    holder: d.holder.trim().length > 100 ? 'Máximo 100 caracteres.' : '',
    cuit: cuit && !cuitValido(cuit) ? 'CUIT/CUIL inválido: son 11 números (ej. 30-12345678-1).' : '',
    account: d.account.trim().length > 200 ? 'Máximo 200 caracteres.' : '',
  };
}

export default function AdminConfiguracion() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const esAdmin = user?.role === 'ADMIN';

  const [creditos, setCreditos] = useState<ConfigCreditos | null>(null);
  const [porcentaje, setPorcentaje] = useState('10');
  const [transferencia, setTransferencia] = useState<DatosTransferencia>(VACIO);
  const [intentoTransferencia, setIntentoTransferencia] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState<'creditos' | 'transferencia' | null>(null);

  useEffect(() => {
    if (!loading && !esAdmin) navigate(user ? '/' : '/login');
  }, [loading, esAdmin, user, navigate]);

  useEffect(() => {
    if (!esAdmin) return;
    api
      .get<{ creditos: ConfigCreditos; transferencia: DatosTransferencia }>('/admin/configuracion')
      .then(({ creditos, transferencia }) => {
        setCreditos(creditos);
        setPorcentaje(String(creditos.porcentajeGarantia));
        setTransferencia({ ...VACIO, ...transferencia });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración'));
  }, [esAdmin]);

  const porcentajeNumero = Number(porcentaje);
  const porcentajeInvalido = !Number.isInteger(porcentajeNumero) || porcentajeNumero < 1 || porcentajeNumero > 100;

  const guardarCreditos = async (e: FormEvent) => {
    e.preventDefault();
    if (!creditos || guardando) return;
    if (creditos.modo === 'GARANTIA' && porcentajeInvalido) {
      setError('El porcentaje de garantía tiene que ser un número entero entre 1 y 100.');
      return;
    }
    setGuardando('creditos');
    setError('');
    setAviso('');
    try {
      const body = {
        modo: creditos.modo,
        porcentajeGarantia: porcentajeInvalido ? creditos.porcentajeGarantia : porcentajeNumero,
      };
      const res = await api.put<{ creditos: ConfigCreditos }>('/admin/configuracion/creditos', body);
      setCreditos(res.creditos);
      setPorcentaje(String(res.creditos.porcentajeGarantia));
      olvidarConfigCreditos();
      setAviso('Sistema de créditos guardado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el sistema de créditos');
    } finally {
      setGuardando(null);
    }
  };

  const errores = erroresTransferencia(transferencia);
  const transferenciaInvalida = Object.values(errores).some(Boolean);

  const guardarTransferencia = async (e: FormEvent) => {
    e.preventDefault();
    setIntentoTransferencia(true);
    if (transferenciaInvalida || guardando) return;
    setGuardando('transferencia');
    setError('');
    setAviso('');
    try {
      const body = {
        alias: transferencia.alias.trim(),
        cbu: sinSeparadores(transferencia.cbu),
        holder: transferencia.holder.trim(),
        cuit: sinSeparadores(transferencia.cuit),
        account: transferencia.account.trim(),
      };
      const res = await api.put<{ transferencia: DatosTransferencia }>('/admin/configuracion/transferencia', body);
      setTransferencia({ ...VACIO, ...res.transferencia });
      setIntentoTransferencia(false);
      setAviso('Datos para transferir guardados.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos para transferir');
    } finally {
      setGuardando(null);
    }
  };

  const campo = (clave: keyof DatosTransferencia, etiqueta: string, extra: { ancho?: boolean; numerico?: boolean } = {}) => {
    // El error se muestra al escribir algo o después de intentar guardar
    const mensaje = intentoTransferencia || transferencia[clave] ? errores[clave] : '';
    return (
      <label className={`${styles.campo} ${extra.ancho ? styles.ancho : ''}`}>
        {etiqueta}
        <input
          className={panel.input}
          value={transferencia[clave]}
          maxLength={LARGO[clave]}
          inputMode={extra.numerico ? 'numeric' : undefined}
          onChange={(e) => setTransferencia((t) => ({ ...t, [clave]: e.target.value }))}
          aria-invalid={Boolean(mensaje)}
        />
        {mensaje && <span className={styles.error}>{mensaje}</span>}
      </label>
    );
  };

  if (!esAdmin) return null;

  return (
    <div className={panel.panel}>
      <div className={panel.header}>
        <div>
          <h1>CONFIGURACIÓN</h1>
          <p className={panel.subtitle}>Cómo se garantizan las ofertas y los datos para transferir que ven los usuarios.</p>
        </div>
      </div>

      {error && <div className={panel.alertDanger}>{error}</div>}
      {aviso && <div className={panel.alertSuccess}>{aviso}</div>}

      <section className={panel.card}>
        <h2>Sistema de créditos</h2>
        {!creditos ? (
          <p className={panel.vacio}>Cargando...</p>
        ) : (
          <form onSubmit={guardarCreditos}>
            <fieldset className={styles.opciones}>
              <legend className={panel.label}>Para poder ofertar:</legend>
              {MODOS.map((m) => (
                <label key={m.valor} className={styles.opcion}>
                  <input
                    type="radio"
                    name="modo"
                    value={m.valor}
                    checked={creditos.modo === m.valor}
                    onChange={() => setCreditos({ ...creditos, modo: m.valor })}
                  />
                  <span>
                    {m.titulo}
                    <span className={styles.ayuda}>{m.ayuda}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {creditos.modo === 'GARANTIA' && (
              <label className={styles.porcentaje}>
                Garantía:
                <input
                  className={panel.input}
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value.slice(0, 3))}
                  aria-invalid={porcentajeInvalido}
                />
                % de la oferta
              </label>
            )}
            <button type="submit" className={panel.btnNegro} disabled={guardando !== null}>
              {guardando === 'creditos' ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        )}
      </section>

      <section className={`${panel.card} ${panel.mt}`}>
        <h2>Datos para transferir</h2>
        <p>Se muestran en la página de Créditos para que los usuarios carguen saldo.</p>
        <form onSubmit={guardarTransferencia} noValidate>
          <div className={styles.campos}>
            {campo('alias', 'Alias')}
            {campo('cbu', 'CBU / CVU', { numerico: true })}
            {campo('holder', 'Titular')}
            {campo('cuit', 'CUIT / CUIL del titular', { numerico: true })}
            {campo('account', 'Cuenta y banco (ej. Cuenta corriente en pesos — Banco X)', { ancho: true })}
          </div>
          <button type="submit" className={panel.btnNegro} disabled={guardando !== null || !creditos}>
            {guardando === 'transferencia' ? 'Guardando...' : 'Guardar datos'}
          </button>
        </form>
      </section>
    </div>
  );
}

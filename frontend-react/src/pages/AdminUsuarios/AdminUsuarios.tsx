import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import Paginacion from '../../components/ui/Paginacion';
import * as v from '../../services/validaciones';
import panel from '../PanelMartillero/PanelMartillero.module.scss';
import styles from './AdminUsuarios.module.scss';

// Base de personas (pedido del cliente, nov 2026): el martillero y los
// admins buscan a la gente registrada, ven y corrigen sus datos y sus compras
// en los remates. Pantalla interna, en la línea de las otras de admin.

type Rol = 'USER' | 'MARTILLERO' | 'ADMIN';

interface Persona {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneAreaCode: string | null;
  phone: string | null;
  phoneVerified: boolean;
  dni: string | null;
  birthDate: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zipCode: string | null;
  role: Rol;
  emailVerified: boolean;
  creditBalance: number;
  createdAt: string;
  deletedAt: string | null;
  compras?: number;
}

interface Ficha {
  user: Persona & { heldCredit: number; profileComplete: boolean };
  purchases: {
    id: string;
    reference: string;
    totalAmount: number;
    createdAt: string;
    lotNumber: number;
    lotBis: boolean;
    lotTitle: string;
    auctionTitle: string;
  }[];
  offers: {
    lotId: string;
    lotNumber: number;
    lotBis: boolean;
    lotTitle: string;
    auctionTitle: string;
    bids: number;
    maxAmount: number;
  }[];
}

interface Pagina {
  users: Persona[];
  total: number;
  pages: number;
}

const ROLES: Record<Rol, string> = { USER: 'Usuario', MARTILLERO: 'Martillero', ADMIN: 'Admin' };
const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR');
const lote = (n: number, bis: boolean) => `${n}${bis ? ' bis' : ''}`;
const celular = (p: Persona) => (p.phone ? `(${p.phoneAreaCode ?? '?'}) ${p.phone}` : '—');
const mensaje = (err: unknown, porDefecto: string) => (err instanceof ApiError ? err.message : porDefecto);

// Campos editables de la ficha ('' = vacío)
const CAMPOS = [
  ['firstName', 'Nombre', v.LARGOS.nombre],
  ['lastName', 'Apellido', v.LARGOS.nombre],
  ['dni', 'DNI / CUIL', 13],
  ['phoneAreaCode', 'Cód. de área', 4],
  ['phone', 'Celular', 8],
  ['birthDate', 'Nacimiento (AAAA-MM-DD)', 10],
  ['address', 'Dirección', v.LARGOS.direccion],
  ['city', 'Ciudad', v.LARGOS.ciudad],
  ['province', 'Provincia', v.LARGOS.provincia],
  ['zipCode', 'Código postal', 8],
] as const;
type CampoEditable = (typeof CAMPOS)[number][0];

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const esStaff = user?.role === 'MARTILLERO' || user?.role === 'ADMIN';

  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState<'' | Rol>('');
  const [datos, setDatos] = useState<'' | 'completos' | 'incompletos'>('');
  const [compradores, setCompradores] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<Pagina | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [form, setForm] = useState<Record<CampoEditable, string>>({} as Record<CampoEditable, string>);
  const [rolFicha, setRolFicha] = useState<Rol>('USER');
  const [celVerificado, setCelVerificado] = useState(false);
  const [mailVerificado, setMailVerificado] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !esStaff) navigate(user ? '/' : '/login');
  }, [loading, esStaff, user, navigate]);

  const cargar = useCallback(async () => {
    const params = new URLSearchParams({ page: String(pagina), pageSize: '20' });
    if (busqueda) params.set('q', busqueda);
    if (rol) params.set('rol', rol);
    if (datos) params.set('datos', datos);
    if (compradores) params.set('compradores', '1');
    try {
      setLista(await api.get<Pagina>(`/admin/usuarios?${params}`));
    } catch (err) {
      setError(mensaje(err, 'No se pudo cargar la lista'));
    }
  }, [pagina, busqueda, rol, datos, compradores]);

  useEffect(() => {
    if (esStaff) cargar();
  }, [esStaff, cargar]);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setBusqueda(q.trim());
  };

  const abrir = async (id: string) => {
    setError('');
    setAviso('');
    try {
      const f = await api.get<Ficha>(`/admin/usuarios/${id}`);
      setFicha(f);
      setForm(Object.fromEntries(CAMPOS.map(([k]) => [k, f.user[k] ?? ''])) as Record<CampoEditable, string>);
      setRolFicha(f.user.role);
      setCelVerificado(f.user.phoneVerified);
      setMailVerificado(f.user.emailVerified);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(mensaje(err, 'No se pudo abrir la ficha'));
    }
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!ficha) return;
    const invalido = v.primero(
      v.nombrePersona(form.firstName, 'nombre'),
      v.nombrePersona(form.lastName, 'apellido'),
      form.dni ? v.dniOCuil(form.dni) : undefined,
      form.zipCode ? v.codigoPostal(form.zipCode) : undefined
    );
    if (invalido) {
      setError(invalido);
      return;
    }
    const cambios: Record<string, unknown> = {
      ...Object.fromEntries(CAMPOS.map(([k]) => [k, form[k].trim()])),
      phoneVerified: celVerificado,
      emailVerified: mailVerificado,
    };
    if (user?.role === 'ADMIN' && rolFicha !== ficha.user.role) cambios.role = rolFicha;
    setBusy(true);
    setError('');
    try {
      const f = await api.patch<Ficha>(`/admin/usuarios/${ficha.user.id}`, cambios);
      setFicha(f);
      setAviso('Datos guardados.');
      cargar();
    } catch (err) {
      setError(mensaje(err, 'No se pudieron guardar los datos'));
    } finally {
      setBusy(false);
    }
  };

  if (!esStaff) return null;

  return (
    <div className={panel.panel}>
      <div className={panel.header}>
        <div>
          <h1>PERSONAS</h1>
          <p className={panel.subtitle}>La gente registrada: sus datos, sus compras y sus ofertas en los remates.</p>
        </div>
      </div>

      {error && <div className={panel.alertDanger}>{error}</div>}
      {aviso && <div className={panel.alertSuccess}>{aviso}</div>}

      {ficha && (
        <section className={panel.card}>
          <div className={styles.fichaCabecera}>
            <h2>
              {ficha.user.firstName} {ficha.user.lastName}
            </h2>
            <button type="button" className={panel.btnGris} onClick={() => setFicha(null)}>
              Cerrar ficha
            </button>
          </div>
          <p className={panel.nota}>
            {ficha.user.email} · {ROLES[ficha.user.role]} · registrado el {fecha(ficha.user.createdAt)} ·{' '}
            {ficha.user.profileComplete ? 'Datos completos para ofertar' : 'Le faltan datos para ofertar'}
          </p>
          <p className={panel.nota}>
            Crédito: <strong>{pesos(ficha.user.creditBalance)}</strong>
            {ficha.user.heldCredit > 0 && ` (${pesos(ficha.user.heldCredit)} reservados)`}
          </p>

          <form className={styles.formFicha} onSubmit={guardar}>
            {CAMPOS.map(([k, etiqueta, max]) => (
              <label key={k} className={styles.campo}>
                <span className={panel.label}>{etiqueta}</span>
                <input
                  className={panel.input}
                  value={form[k] ?? ''}
                  maxLength={max}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                />
              </label>
            ))}
            <label className={styles.check}>
              <input type="checkbox" checked={celVerificado} onChange={(e) => setCelVerificado(e.target.checked)} />
              Celular verificado
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={mailVerificado} onChange={(e) => setMailVerificado(e.target.checked)} />
              Mail verificado
            </label>
            {user?.role === 'ADMIN' && ficha.user.id !== user.id && (
              <label className={styles.campo}>
                <span className={panel.label}>Rol</span>
                <select className={panel.input} value={rolFicha} onChange={(e) => setRolFicha(e.target.value as Rol)}>
                  {(Object.keys(ROLES) as Rol[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className={styles.botonera}>
              <button type="submit" className={panel.btnNegro} disabled={busy}>
                {busy ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </form>

          <h3 className={panel.mt}>Compras ({ficha.purchases.length})</h3>
          {ficha.purchases.length === 0 ? (
            <p className={panel.vacio}>Todavía no compró nada.</p>
          ) : (
            <div className={panel.tableResponsive}>
              <table className={panel.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Remate</th>
                    <th>Lote</th>
                    <th>Monto</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.purchases.map((c) => (
                    <tr key={c.id}>
                      <td>{fecha(c.createdAt)}</td>
                      <td>{c.auctionTitle}</td>
                      <td>
                        {lote(c.lotNumber, c.lotBis)} · {c.lotTitle}
                      </td>
                      <td>{pesos(c.totalAmount)}</td>
                      <td>{c.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className={panel.mt}>Lotes en los que ofertó ({ficha.offers.length})</h3>
          {ficha.offers.length === 0 ? (
            <p className={panel.vacio}>Todavía no ofertó.</p>
          ) : (
            <div className={panel.tableResponsive}>
              <table className={panel.table}>
                <thead>
                  <tr>
                    <th>Remate</th>
                    <th>Lote</th>
                    <th>Ofertas</th>
                    <th>Su mejor oferta</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.offers.map((o) => (
                    <tr key={o.lotId}>
                      <td>{o.auctionTitle}</td>
                      <td>
                        {lote(o.lotNumber, o.lotBis)} · {o.lotTitle}
                      </td>
                      <td>{o.bids}</td>
                      <td>{pesos(o.maxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className={panel.card}>
        <form className={styles.filtros} onSubmit={buscar}>
          <input
            className={panel.input}
            placeholder="Buscar por nombre, mail, DNI o celular"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
          />
          <select
            className={panel.input}
            value={rol}
            onChange={(e) => {
              setPagina(1);
              setRol(e.target.value as '' | Rol);
            }}
          >
            <option value="">Todos los roles</option>
            {(Object.keys(ROLES) as Rol[]).map((r) => (
              <option key={r} value={r}>
                {ROLES[r]}
              </option>
            ))}
          </select>
          <select
            className={panel.input}
            value={datos}
            onChange={(e) => {
              setPagina(1);
              setDatos(e.target.value as '' | 'completos' | 'incompletos');
            }}
          >
            <option value="">Datos: todos</option>
            <option value="completos">Datos completos</option>
            <option value="incompletos">Les faltan datos</option>
          </select>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={compradores}
              onChange={(e) => {
                setPagina(1);
                setCompradores(e.target.checked);
              }}
            />
            Con compras
          </label>
          <button type="submit" className={panel.btnNegro}>
            Buscar
          </button>
        </form>

        {lista === null ? (
          <p className={panel.vacio}>Cargando...</p>
        ) : lista.users.length === 0 ? (
          <p className={panel.vacio}>No hay personas con esos filtros.</p>
        ) : (
          <>
            <p className={panel.nota}>{lista.total} {lista.total === 1 ? "persona" : "personas"}</p>
            <div className={panel.tableResponsive}>
              <table className={panel.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Mail</th>
                    <th>DNI / CUIL</th>
                    <th>Celular</th>
                    <th>Ciudad</th>
                    <th>Rol</th>
                    <th>Compras</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.users.map((p) => (
                    <tr key={p.id} className={ficha?.user.id === p.id ? panel.filaActual : ''}>
                      <td>
                        {p.firstName} {p.lastName}
                      </td>
                      <td>{p.email}</td>
                      <td>{p.dni ?? '—'}</td>
                      <td>
                        {celular(p)}
                        {p.phone && !p.phoneVerified && <span className={styles.sinVerificar}> sin verificar</span>}
                      </td>
                      <td>{p.city ?? '—'}</td>
                      <td>{ROLES[p.role]}</td>
                      <td>{p.compras ?? 0}</td>
                      <td>
                        <button type="button" className={panel.btnChico} onClick={() => abrir(p.id)}>
                          Ver ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={pagina} totalPaginas={lista.pages} onCambiar={setPagina} etiqueta="Páginas de personas" />
          </>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError, uploadUrl } from '../../services/api';
import type { AuctionStatus } from '../../services/auctions';
import LotesSubasta, { type LotAdmin } from './LotesSubasta';
import panel from '../PanelMartillero/PanelMartillero.module.scss';
import styles from './AdminSubastas.module.scss';

// Alta / edición de una subasta (pantalla interna, sin diseño de la
// diseñadora): datos, foto de portada, estado y sus lotes con fotos.
// /admin/subastas/nueva crea; /admin/subastas/:id edita.

export interface AuctionAdmin {
  id: string;
  title: string;
  description: string;
  location: string;
  coverImageUrl: string | null;
  startsAt: string;
  status: AuctionStatus;
  lots: LotAdmin[];
}

interface FormSubasta {
  title: string;
  description: string;
  location: string;
  startsAt: string; // formato de <input type="datetime-local">, hora local
  status: AuctionStatus;
}

const ESTADOS: Record<AuctionStatus, string> = {
  PROXIMA: 'Próxima',
  ACTIVA: 'Activa (en vivo)',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const VACIO: FormSubasta = { title: '', description: '', location: '', startsAt: '', status: 'PROXIMA' };

/** ISO (UTC) → "2026-10-03T19:30" en hora local, para el datetime-local */
function aInputLocal(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const mensaje = (err: unknown, porDefecto: string) => (err instanceof ApiError ? err.message : porDefecto);

export default function EditarSubasta() {
  const { id } = useParams<{ id: string }>();
  const esNueva = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const esMartillero = user?.role === 'MARTILLERO' || user?.role === 'ADMIN';

  const [auction, setAuction] = useState<AuctionAdmin | null>(null);
  const [form, setForm] = useState<FormSubasta>(VACIO);
  const [portadaNueva, setPortadaNueva] = useState<File | null>(null); // solo al crear
  const [error, setError] = useState(() => (location.state as { error?: string } | null)?.error ?? '');
  // Al crear se navega a /admin/subastas/:id con el aviso en el state
  const [aviso, setAviso] = useState(() => (location.state as { aviso?: string } | null)?.aviso ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !esMartillero) navigate(user ? '/' : '/login');
  }, [loading, esMartillero, user, navigate]);

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      const { auction } = await api.get<{ auction: AuctionAdmin }>(`/subastas/${id}`);
      setAuction(auction);
      return auction;
    } catch (err) {
      setError(mensaje(err, 'No se pudo cargar la subasta'));
    }
  }, [id]);

  // Al entrar a editar se llena el form (en App.tsx "nueva" y ":id" tienen
  // distinta key, así que al crear el componente se monta de cero)
  useEffect(() => {
    if (!esMartillero || !id) return;
    cargar().then((a) => {
      if (a) {
        setForm({
          title: a.title,
          description: a.description,
          location: a.location,
          startsAt: aInputLocal(a.startsAt),
          status: a.status,
        });
      }
    });
  }, [esMartillero, id, cargar]);

  // Vista previa de la portada elegida antes de crear la subasta
  const previewNueva = useMemo(() => (portadaNueva ? URL.createObjectURL(portadaNueva) : null), [portadaNueva]);
  useEffect(() => () => {
    if (previewNueva) URL.revokeObjectURL(previewNueva);
  }, [previewNueva]);

  const set = (campo: keyof FormSubasta) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  const limpiarMensajes = () => {
    setError('');
    setAviso('');
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    limpiarMensajes();
    const fecha = new Date(form.startsAt);
    if (!form.startsAt || Number.isNaN(fecha.getTime())) {
      setError('Indicá la fecha y hora de inicio');
      return;
    }
    const datos = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      startsAt: fecha.toISOString(),
    };

    setBusy(true);
    try {
      if (esNueva) {
        const { auction: creada } = await api.post<{ auction: AuctionAdmin }>('/subastas', datos);
        let avisoPortada = '';
        if (portadaNueva) {
          try {
            await subirArchivoPortada(creada.id, portadaNueva);
          } catch (err) {
            avisoPortada = ` Pero no se pudo subir la portada: ${mensaje(err, 'error inesperado')}`;
          }
        }
        navigate(`/admin/subastas/${creada.id}`, {
          replace: true,
          state: avisoPortada
            ? { error: `Subasta creada.${avisoPortada}` }
            : { aviso: 'Subasta creada. Ahora podés cargarle los lotes.' },
        });
        return;
      } else {
        await api.patch(`/subastas/${id}`, { ...datos, status: form.status });
        await cargar();
        setAviso('Cambios guardados.');
      }
    } catch (err) {
      setError(mensaje(err, 'No se pudo guardar la subasta'));
    } finally {
      setBusy(false);
    }
  };

  const subirArchivoPortada = (auctionId: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post<{ auction: AuctionAdmin }>(`/subastas/${auctionId}/portada`, fd);
  };

  const elegirPortada = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!id) {
      setPortadaNueva(file);
      return;
    }
    limpiarMensajes();
    setBusy(true);
    try {
      await subirArchivoPortada(id, file);
      await cargar();
      setAviso('Portada actualizada.');
    } catch (err) {
      setError(mensaje(err, 'No se pudo subir la portada'));
    } finally {
      setBusy(false);
    }
  };

  const quitarPortada = async () => {
    if (esNueva) {
      setPortadaNueva(null);
      return;
    }
    if (!window.confirm('¿Quitar la foto de portada?')) return;
    limpiarMensajes();
    setBusy(true);
    try {
      await api.patch(`/subastas/${id}`, { coverImageUrl: null });
      await cargar();
      setAviso('Portada quitada.');
    } catch (err) {
      setError(mensaje(err, 'No se pudo quitar la portada'));
    } finally {
      setBusy(false);
    }
  };

  const borrarSubasta = async () => {
    if (!auction) return;
    const lotes = auction.lots.length;
    const detalle = lotes ? ` con sus ${lotes} lote${lotes === 1 ? '' : 's'} y fotos` : '';
    if (!window.confirm(`¿Borrar la subasta "${auction.title}"${detalle}? No se puede deshacer.`)) return;
    limpiarMensajes();
    setBusy(true);
    try {
      await api.delete(`/subastas/${auction.id}`);
      navigate('/admin/subastas');
    } catch (err) {
      setError(mensaje(err, 'No se pudo borrar la subasta'));
      setBusy(false);
    }
  };

  if (!esMartillero) return null;

  const portadaActual = esNueva ? previewNueva : auction?.coverImageUrl ? uploadUrl(auction.coverImageUrl) : null;
  const cargando = !esNueva && !auction;

  return (
    <div className={panel.panel}>
      <div className={panel.header}>
        <div>
          <h1>{esNueva ? 'NUEVA SUBASTA' : 'EDITAR SUBASTA'}</h1>
          <p className={panel.subtitle}>
            {esNueva ? 'Completá los datos del remate. Los lotes se cargan después de crearlo.' : auction?.title ?? 'Cargando...'}
          </p>
        </div>
        <div className={styles.links}>
          <Link to="/admin/subastas" className={panel.btnGris}>
            Volver a la lista
          </Link>
          {!esNueva && (
            <>
              <Link to={`/subastas/${id}/martillero`} className={panel.btnGris}>
                Panel del martillero
              </Link>
              <Link to={`/subastas/${id}/activa`} className={panel.btnGris}>
                Ver la sala
              </Link>
            </>
          )}
        </div>
      </div>

      {error && <div className={panel.alertDanger}>{error}</div>}
      {aviso && <div className={panel.alertSuccess}>{aviso}</div>}

      {cargando ? (
        <section className={panel.card}>
          <p className={panel.vacio}>{error ? 'No se pudo cargar la subasta.' : 'Cargando...'}</p>
        </section>
      ) : (
        <>
          {/* Datos de la subasta */}
          <section className={panel.card}>
            <h2>Datos de la subasta</h2>
            <form className={styles.form} onSubmit={guardar}>
              <label className={`${styles.campo} ${styles.campoAncho}`}>
                <span>Título</span>
                <input className={panel.input} value={form.title} onChange={set('title')} required maxLength={200} />
              </label>
              <label className={`${styles.campo} ${styles.campoAncho}`}>
                <span>Descripción</span>
                <textarea className={panel.input} value={form.description} onChange={set('description')} required rows={4} />
              </label>
              <label className={styles.campo}>
                <span>Ubicación</span>
                <input
                  className={panel.input}
                  value={form.location}
                  onChange={set('location')}
                  required
                  placeholder="Ej: Castelar, Morón"
                />
              </label>
              <label className={styles.campo}>
                <span>Fecha y hora de inicio</span>
                <input
                  className={panel.input}
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={set('startsAt')}
                  required
                />
              </label>
              {!esNueva && (
                <label className={styles.campo}>
                  <span>Estado</span>
                  <select className={panel.input} value={form.status} onChange={set('status')}>
                    {(Object.keys(ESTADOS) as AuctionStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {ESTADOS[s]}
                      </option>
                    ))}
                  </select>
                  <span className={styles.ayuda}>
                    "Activa" abre la sala en vivo. También se puede cambiar desde el panel del martillero.
                  </span>
                </label>
              )}

              <div className={`${styles.campo} ${styles.campoAncho}`}>
                <span>Foto de portada</span>
                <div className={styles.portada}>
                  {portadaActual ? (
                    <img className={styles.portadaImg} src={portadaActual} alt="Portada de la subasta" />
                  ) : (
                    <div className={styles.portadaVacia}>Sin portada</div>
                  )}
                  <div className={styles.portadaAcciones}>
                    <label className={`${panel.btnChico} ${styles.archivo}`}>
                      {portadaActual ? 'Cambiar portada' : 'Subir portada'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={elegirPortada} disabled={busy} />
                    </label>
                    {portadaActual && (
                      <button type="button" className={`${panel.btnGris} ${styles.chico}`} onClick={quitarPortada} disabled={busy}>
                        Quitar portada
                      </button>
                    )}
                    <span className={styles.ayuda}>
                      PNG, JPG, WEBP o GIF, hasta 8 MB.
                      {esNueva && portadaNueva ? ' Se sube al crear la subasta.' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.botonera}>
                <button type="submit" className={panel.btnNegro} disabled={busy}>
                  {busy ? 'Guardando...' : esNueva ? 'Crear subasta' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>

          {/* Lotes */}
          {auction && (
            <LotesSubasta
              auction={auction}
              onChange={cargar}
              onError={(msg) => {
                setAviso('');
                setError(msg);
              }}
              onAviso={(msg) => {
                setError('');
                setAviso(msg);
              }}
            />
          )}

          {/* Borrar */}
          {auction && (
            <section className={`${panel.card} ${styles.peligro}`}>
              <h2>Borrar subasta</h2>
              <p className={panel.nota}>
                Borra la subasta con todos sus lotes y fotos. No se puede si ya recibió ofertas o tiene lotes vendidos:
                en ese caso, cambiá el estado a "Cancelada".
              </p>
              <button type="button" className={styles.btnRojo} onClick={borrarSubasta} disabled={busy}>
                Borrar subasta
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

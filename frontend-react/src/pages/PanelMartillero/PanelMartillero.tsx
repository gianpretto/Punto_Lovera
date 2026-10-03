import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LivePlayer from '../../components/LivePlayer/LivePlayer';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError, getToken } from '../../services/api';
import { useAuctionRoom } from '../../services/useAuctionRoom';
import styles from './PanelMartillero.module.scss';

// Panel del martillero (pantalla nueva, no existe en el diseño Angular):
// elegir qué lote se remata, adjudicarlo, abrir/cerrar la subasta y
// prender/apagar la cámara. Todo lo que cambia acá le llega a la sala en
// vivo por el socket (lot:change / lot:sold / estado de la cámara).

type AuctionStatus = 'PROXIMA' | 'ACTIVA' | 'FINALIZADA' | 'CANCELADA';

interface LotApi {
  id: string;
  number: number;
  title: string;
  startingPrice: string;
  currentPrice: string;
  sold: boolean;
}

interface AuctionApi {
  id: string;
  title: string;
  location: string;
  status: AuctionStatus;
  cameraId: string | null;
  lots: LotApi[];
}

// GET /api/subastas/:id/camara
interface StreamInfo {
  mode: 'obs' | 'rtsp';
  cameraId: string | null;
  rtmpUrl: string | null;
  streamKey: string | null;
  receiving: boolean;
}

interface PassApi {
  id: string;
  label: string;
  link: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

const DURACIONES = [
  { horas: 3, texto: '3 horas' },
  { horas: 12, texto: '12 horas' },
  { horas: 24, texto: '1 día' },
  { horas: 72, texto: '3 días' },
  { horas: 168, texto: '1 semana' },
];

interface BidApi {
  id: string;
  amount: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

const ESTADOS: Record<AuctionStatus, string> = {
  PROXIMA: 'Próxima',
  ACTIVA: 'Activa (en vivo)',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const pesos = (n: number | string) => `$${Number(n).toLocaleString('es-AR')}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function PanelMartillero() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const esMartillero = user?.role === 'MARTILLERO' || user?.role === 'ADMIN';
  const token = user ? getToken() : null;

  const { state, connected } = useAuctionRoom(esMartillero ? id : undefined, token);
  const lotActual = state?.lot ?? null;

  const [auction, setAuction] = useState<AuctionApi | null>(null);
  const [bids, setBids] = useState<BidApi[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState(false);
  const [camNombre, setCamNombre] = useState('Cámara principal');
  const [camUrl, setCamUrl] = useState('');
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [verClave, setVerClave] = useState(false);
  const [copiadoCampo, setCopiadoCampo] = useState<string | null>(null);
  const [passes, setPasses] = useState<PassApi[]>([]);
  const [paseLabel, setPaseLabel] = useState('');
  const [paseHoras, setPaseHoras] = useState(24);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !esMartillero) navigate(user ? '/' : '/login');
  }, [loading, esMartillero, user, navigate]);

  const cargarSubasta = useCallback(async () => {
    if (!id) return;
    try {
      const { auction } = await api.get<{ auction: AuctionApi }>(`/subastas/${id}`);
      setAuction(auction);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la subasta');
    }
  }, [id]);

  const cargarPases = useCallback(async () => {
    if (!id) return;
    try {
      const { passes } = await api.get<{ passes: PassApi[] }>(`/subastas/${id}/pases`);
      setPasses(passes);
    } catch {
      setPasses([]);
    }
  }, [id]);

  useEffect(() => {
    if (esMartillero) cargarPases();
  }, [esMartillero, cargarPases]);

  const cargarStream = useCallback(async () => {
    if (!id) return;
    try {
      setStream(await api.get<StreamInfo>(`/subastas/${id}/camara`));
    } catch {
      setStream(null);
    }
  }, [id]);

  // Estado de la transmisión: al entrar, al cambiar la cámara y cada 10 s
  // mientras hay clave (para mostrar "recibiendo señal" cuando OBS arranca)
  useEffect(() => {
    if (!esMartillero) return;
    cargarStream();
    if (!state?.auction.cameraId) return;
    const t = setInterval(cargarStream, 10000);
    return () => clearInterval(t);
  }, [esMartillero, cargarStream, state?.auction.cameraId]);

  // Se recarga cada vez que la sala cambia (lote nuevo, puja, cámara)
  useEffect(() => {
    if (esMartillero) cargarSubasta();
  }, [esMartillero, cargarSubasta, lotActual?.id, lotActual?.currentPrice, state?.auction.cameraId]);

  useEffect(() => {
    if (!id || !lotActual) {
      setBids([]);
      return;
    }
    api
      .get<{ bids: BidApi[] }>(`/subastas/${id}/lotes/${lotActual.id}/pujas`)
      .then(({ bids }) => setBids(bids))
      .catch(() => setBids([]));
  }, [id, lotActual?.id, lotActual?.currentPrice]);

  const accion = async (fn: () => Promise<unknown>, ok?: string) => {
    setError('');
    setAviso('');
    setBusy(true);
    try {
      await fn();
      if (ok) setAviso(ok);
      await cargarSubasta();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error');
    } finally {
      setBusy(false);
    }
  };

  const cambiarEstado = (status: AuctionStatus) =>
    accion(() => api.patch(`/subastas/${id}`, { status }), `La subasta quedó ${ESTADOS[status].toLowerCase()}.`);

  const ponerEnRemate = (lotId: string) =>
    accion(() => api.patch(`/subastas/${id}/lote-actual`, { lotId }));

  const adjudicar = () => {
    if (!lotActual) return;
    const mejor = bids[0];
    if (!mejor) {
      setError('Este lote no tiene pujas: no se puede adjudicar. Podés pasar a otro lote.');
      return;
    }
    const quien = `${mejor.user.firstName} ${mejor.user.lastName}`;
    if (!window.confirm(`¿Adjudicar "${lotActual.title}" a ${quien} por ${pesos(mejor.amount)}?`)) return;
    accion(() => api.post(`/compras/cerrar-lote/${lotActual.id}`), `Lote adjudicado a ${quien}.`);
  };

  const prenderCamara = (e: FormEvent) => {
    e.preventDefault();
    accion(async () => {
      await api.post(`/subastas/${id}/camara`, { name: camNombre, rtspUrl: camUrl });
      await cargarStream();
    }, 'Cámara prendida. El video tarda unos segundos en aparecer.');
  };

  const habilitarObs = () =>
    accion(async () => {
      await api.post(`/subastas/${id}/camara`, {});
      await cargarStream();
    }, 'Clave generada. Configurá OBS con el servidor y la clave, y tocá "Iniciar transmisión".');

  const copiarCampo = async (campo: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiadoCampo(campo);
      setTimeout(() => setCopiadoCampo(null), 2000);
    } catch {
      window.prompt('Copiá este valor:', valor);
    }
  };

  const crearPase = (e: FormEvent) => {
    e.preventDefault();
    accion(async () => {
      const { pass } = await api.post<{ pass: PassApi }>(`/subastas/${id}/pases`, { label: paseLabel, hours: paseHoras });
      setPaseLabel('');
      await cargarPases();
      await copiarLink(pass);
    }, 'Pase creado. El link quedó copiado: mandáselo a la persona invitada.');
  };

  const copiarLink = async (pass: PassApi) => {
    try {
      await navigator.clipboard.writeText(pass.link);
      setCopiado(pass.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt('Copiá el link del pase:', pass.link);
    }
  };

  const revocarPase = (pass: PassApi) => {
    if (!window.confirm(`¿Revocar el pase de "${pass.label}"? El link deja de funcionar.`)) return;
    accion(async () => {
      await api.delete(`/subastas/${id}/pases/${pass.id}`);
      await cargarPases();
    }, 'Pase revocado.');
  };

  const apagarCamara = () => {
    const obs = stream?.mode === 'obs';
    if (
      !window.confirm(
        obs
          ? '¿Detener la transmisión y anular la clave? La sala deja de ver el video y OBS se desconecta.'
          : '¿Apagar la cámara? La sala deja de ver el video.'
      )
    )
      return;
    accion(async () => {
      await api.delete(`/subastas/${id}/camara`);
      setVerClave(false);
      await cargarStream();
    }, obs ? 'Transmisión detenida y clave anulada.' : 'Cámara apagada.');
  };

  if (!esMartillero || !id) return null;

  const status = auction?.status;
  const cameraId = state?.auction.cameraId ?? auction?.cameraId ?? null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h1>PANEL DEL MARTILLERO</h1>
          <p className={styles.subtitle}>
            {auction ? `${auction.title} · ${auction.location}` : 'Cargando...'}
          </p>
        </div>
        <Link to={`/subastas/${id}/activa`} className={styles.btnGris}>Ver la sala</Link>
      </div>

      {error && <div className={styles.alertDanger}>{error}</div>}
      {aviso && <div className={styles.alertSuccess}>{aviso}</div>}

      <div className={styles.grid}>
        {/* Lote en remate */}
        <section className={styles.card}>
          <h2>Lote en remate</h2>
          {lotActual ? (
            <>
              <p className={styles.lotTitle}>
                Lote {lotActual.number} · {lotActual.title}
              </p>
              <div className={styles.precios}>
                <div>
                  <span className={styles.label}>Precio actual</span>
                  <span className={styles.precio}>{pesos(lotActual.currentPrice)}</span>
                </div>
                <div>
                  <span className={styles.label}>Próxima puja mínima</span>
                  <span className={styles.precio}>{pesos(lotActual.minNextBid)}</span>
                </div>
              </div>

              <h3>Últimas pujas</h3>
              {bids.length === 0 ? (
                <p className={styles.vacio}>Todavía no hay pujas.</p>
              ) : (
                <ul className={styles.bids}>
                  {bids.slice(0, 8).map((b, i) => (
                    <li key={b.id} className={i === 0 ? styles.bidMejor : ''}>
                      <span>{b.user.firstName} {b.user.lastName}</span>
                      <strong>{pesos(b.amount)}</strong>
                      <span className={styles.hora}>{hora(b.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button className={styles.btnNegro} onClick={adjudicar} disabled={busy || bids.length === 0}>
                Adjudicar lote al mejor postor
              </button>
            </>
          ) : (
            <p className={styles.vacio}>{state ? 'No quedan lotes sin vender.' : 'Conectando con la sala...'}</p>
          )}
          <p className={styles.conexion}>{connected ? '● Conectado a la sala' : '○ Sin conexión con la sala'}</p>
        </section>

        {/* Estado de la subasta + cámara */}
        <section className={styles.card}>
          <h2>Subasta</h2>
          <p>
            Estado: <strong>{status ? ESTADOS[status] : '...'}</strong>
          </p>
          <div className={styles.acciones}>
            {status !== 'ACTIVA' && (
              <button className={styles.btnNegro} onClick={() => cambiarEstado('ACTIVA')} disabled={busy}>
                Abrir subasta
              </button>
            )}
            {status === 'ACTIVA' && (
              <button
                className={styles.btnGris}
                onClick={() => window.confirm('¿Finalizar la subasta? Ya no se van a poder hacer pujas.') && cambiarEstado('FINALIZADA')}
                disabled={busy}
              >
                Finalizar subasta
              </button>
            )}
          </div>
          {status !== 'ACTIVA' && <p className={styles.nota}>Solo se puede pujar con la subasta abierta.</p>}

          <h2 className={styles.mt}>Cámara</h2>
          <div className={styles.preview}>
            <LivePlayer
              auctionId={id}
              cameraId={cameraId}
              token={token}
              placeholder={<div className={styles.sinVideo}>Sin cámara</div>}
            />
          </div>
          {stream?.mode === 'obs' ? (
            cameraId && stream.streamKey ? (
              <div className={styles.obsBox}>
                <p className={stream.receiving ? styles.senalOk : styles.senalNo}>
                  {stream.receiving ? '● Recibiendo señal de OBS' : '○ Esperando que OBS empiece a transmitir'}
                </p>
                <label className={styles.label}>Servidor</label>
                <div className={styles.copiable}>
                  <code>{stream.rtmpUrl}</code>
                  <button className={styles.btnChico} onClick={() => copiarCampo('server', stream.rtmpUrl ?? '')}>
                    {copiadoCampo === 'server' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
                <label className={styles.label}>Clave de transmisión</label>
                <div className={styles.copiable}>
                  <code>{verClave ? stream.streamKey : '••••••••••••••••••••'}</code>
                  <button className={styles.btnChico} onClick={() => setVerClave((v) => !v)}>
                    {verClave ? 'Ocultar' : 'Ver'}
                  </button>
                  <button className={styles.btnChico} onClick={() => copiarCampo('key', stream.streamKey ?? '')}>
                    {copiadoCampo === 'key' ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className={styles.nota}>
                  En OBS: <strong>Ajustes → Emisión</strong> → Servicio <strong>Personalizado</strong>, pegá el
                  servidor y la clave, y tocá <strong>Iniciar transmisión</strong>. No compartas la clave: quien la
                  tenga puede transmitir en esta subasta.
                </p>
                <button className={styles.btnGris} onClick={apagarCamara} disabled={busy}>
                  Detener y anular clave
                </button>
              </div>
            ) : (
              <>
                <p className={styles.nota}>
                  Generá una clave de transmisión para esta subasta y usala en OBS desde la PC del remate.
                </p>
                <button className={styles.btnNegro} onClick={habilitarObs} disabled={busy}>
                  Generar clave de transmisión
                </button>
              </>
            )
          ) : cameraId ? (
            <button className={styles.btnGris} onClick={apagarCamara} disabled={busy}>
              Apagar cámara
            </button>
          ) : (
            <form className={styles.camForm} onSubmit={prenderCamara}>
              <input
                className={styles.input}
                placeholder="Nombre de la cámara"
                value={camNombre}
                onChange={(e) => setCamNombre(e.target.value)}
                required
              />
              <input
                className={styles.input}
                placeholder="rtsp://usuario:clave@ip:554/stream"
                value={camUrl}
                onChange={(e) => setCamUrl(e.target.value)}
                required
              />
              <button className={styles.btnNegro} type="submit" disabled={busy || !camUrl.startsWith('rtsp://')}>
                Prender cámara
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Pases de invitado (pedido del cliente: mirar sin crearse cuenta) */}
      <section className={styles.card}>
        <h2>Pases de invitado</h2>
        <p className={styles.nota}>
          Link temporal para que alguien mire el remate sin crearse una cuenta (ej: el dueño del local). Con el pase
          ve el video y el chat, pero no puede ofertar ni escribir.
        </p>
        <form className={styles.paseForm} onSubmit={crearPase}>
          <input
            className={styles.input}
            placeholder="¿Para quién es? (ej: Dueño del local)"
            value={paseLabel}
            onChange={(e) => setPaseLabel(e.target.value)}
            maxLength={80}
            required
          />
          <select className={styles.input} value={paseHoras} onChange={(e) => setPaseHoras(Number(e.target.value))}>
            {DURACIONES.map((d) => (
              <option key={d.horas} value={d.horas}>
                Vence en {d.texto}
              </option>
            ))}
          </select>
          <button className={styles.btnNegro} type="submit" disabled={busy || !paseLabel.trim()}>
            Crear pase y copiar link
          </button>
        </form>

        {passes.length > 0 && (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Para</th>
                  <th>Vence</th>
                  <th>Último uso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {passes.map((ps) => (
                  <tr key={ps.id}>
                    <td>{ps.label}</td>
                    <td>{new Date(ps.expiresAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{ps.lastUsedAt ? hora(ps.lastUsedAt) : 'Sin usar'}</td>
                    <td>
                      <div className={styles.acciones}>
                        <button className={styles.btnChico} onClick={() => copiarLink(ps)}>
                          {copiado === ps.id ? '¡Copiado!' : 'Copiar link'}
                        </button>
                        <button className={styles.btnChico} onClick={() => revocarPase(ps)} disabled={busy}>
                          Revocar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Todos los lotes */}
      <section className={styles.card}>
        <h2>Lotes</h2>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Lote</th>
                <th>Base</th>
                <th>Precio actual</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {auction?.lots.map((l) => {
                const enRemate = lotActual?.id === l.id;
                return (
                  <tr key={l.id} className={enRemate ? styles.filaActual : ''}>
                    <td>{l.number}</td>
                    <td>{l.title}</td>
                    <td>{pesos(l.startingPrice)}</td>
                    <td>{pesos(l.currentPrice)}</td>
                    <td>{l.sold ? 'Vendido' : enRemate ? 'En remate' : 'Pendiente'}</td>
                    <td>
                      {!l.sold && !enRemate && (
                        <button className={styles.btnChico} onClick={() => ponerEnRemate(l.id)} disabled={busy}>
                          Poner en remate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

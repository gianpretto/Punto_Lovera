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
  cameraOn: boolean;
  lots: LotApi[];
}

// GET /api/subastas/:id/camara
interface StreamInfo {
  mode: 'obs' | 'rtsp';
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
  userId: string;
  amount: string;
  createdAt: string;
  /** Anulada por el martillero (no cuenta para el precio ni el ganador) */
  voidedAt: string | null;
  user: { firstName: string; lastName: string };
}

// GET /api/subastas/:id/sanciones (moderación de la sala, solo este remate)
interface SanctionApi {
  id: string;
  userId: string;
  type: 'SILENCIADO' | 'EXPULSADO';
  createdAt: string;
  user: { firstName: string; lastName: string };
}

const SANCIONES: Record<SanctionApi['type'], string> = {
  SILENCIADO: 'Silenciado en el chat',
  EXPULSADO: 'Expulsado de la sala',
};

/** "450.000" / "$ 450.000" → 450000 (vacío o inválido → null) */
const leerMonto = (texto: string) => {
  const limpio = texto.replace(/[^0-9]/g, '');
  return limpio ? Number(limpio) : null;
};

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
  const [sanciones, setSanciones] = useState<SanctionApi[]>([]);
  // Correcciones en vivo del lote en remate (vacío = no cambiar)
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevoIncremento, setNuevoIncremento] = useState('');
  const [nuevaMinima, setNuevaMinima] = useState('');
  const [nuevoLider, setNuevoLider] = useState('');

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
    if (!state?.auction.cameraOn) return;
    const t = setInterval(cargarStream, 10000);
    return () => clearInterval(t);
  }, [esMartillero, cargarStream, state?.auction.cameraOn]);

  // Se recarga cada vez que la sala cambia (lote nuevo, puja, cámara)
  useEffect(() => {
    if (esMartillero) cargarSubasta();
  }, [esMartillero, cargarSubasta, lotActual?.id, lotActual?.currentPrice, state?.auction.cameraOn]);

  const lotActualId = lotActual?.id;
  const cargarPujas = useCallback(async () => {
    if (!id || !lotActualId) {
      setBids([]);
      return;
    }
    try {
      const { bids } = await api.get<{ bids: BidApi[] }>(`/subastas/${id}/lotes/${lotActualId}/pujas`);
      setBids(bids);
    } catch {
      setBids([]);
    }
  }, [id, lotActualId]);

  useEffect(() => {
    cargarPujas();
  }, [cargarPujas, lotActual?.currentPrice, lotActual?.leaderId]);

  // Otro lote en remate: los campos de corrección arrancan vacíos
  useEffect(() => {
    setNuevoPrecio('');
    setNuevoIncremento('');
    setNuevaMinima('');
    setNuevoLider('');
  }, [lotActual?.id]);

  const cargarSanciones = useCallback(async () => {
    if (!id) return;
    try {
      const { sanctions } = await api.get<{ sanctions: SanctionApi[] }>(`/subastas/${id}/sanciones`);
      setSanciones(sanctions);
    } catch {
      setSanciones([]);
    }
  }, [id]);

  // Las sanciones se aplican desde el chat de la sala: se refresca cada 20 s
  useEffect(() => {
    if (!esMartillero) return;
    cargarSanciones();
    const t = setInterval(cargarSanciones, 20000);
    return () => clearInterval(t);
  }, [esMartillero, cargarSanciones]);

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

  // Postores del lote (sin repetir), para elegir quién va ganando
  const postores = bids.reduce<{ userId: string; nombre: string }[]>((lista, b) => {
    if (!lista.some((p) => p.userId === b.userId)) {
      lista.push({ userId: b.userId, nombre: `${b.user.firstName} ${b.user.lastName}` });
    }
    return lista;
  }, []);
  const nombreDe = (userId: string | null) =>
    userId ? (postores.find((p) => p.userId === userId)?.nombre ?? 'Otro usuario') : 'Nadie';
  const minimaManual =
    lotActual != null && lotActual.minNextBid !== lotActual.currentPrice + lotActual.bidIncrement;

  // Gana quien va ganando el lote (ya contempla anulaciones y correcciones)
  const adjudicar = () => {
    if (!lotActual) return;
    if (!lotActual.leaderId) {
      setError('Este lote no tiene a nadie ganando: no se puede adjudicar. Podés pasar a otro lote.');
      return;
    }
    const quien = nombreDe(lotActual.leaderId);
    if (!window.confirm(`¿Adjudicar "${lotActual.title}" a ${quien} por ${pesos(lotActual.currentPrice)}?`)) return;
    accion(() => api.post(`/compras/cerrar-lote/${lotActual.id}`), `Lote adjudicado a ${quien}.`);
  };

  const siguienteLote = () => accion(() => api.post(`/subastas/${id}/siguiente-lote`));

  /** PATCH en vivo del lote en remate (precio, incremento, mínima, líder) */
  const corregirLote = (cambios: Record<string, unknown>, ok: string, limpiar: () => void) => {
    if (!lotActual) return;
    accion(async () => {
      await api.patch(`/subastas/${id}/lotes/${lotActual.id}/vivo`, cambios);
      limpiar();
      await cargarPujas();
    }, ok);
  };

  const cambiarPrecio = (e: FormEvent) => {
    e.preventDefault();
    const valor = leerMonto(nuevoPrecio);
    if (valor == null) return;
    corregirLote({ currentPrice: valor }, `Precio actual corregido a ${pesos(valor)}.`, () => setNuevoPrecio(''));
  };

  const cambiarIncremento = (e: FormEvent) => {
    e.preventDefault();
    const valor = leerMonto(nuevoIncremento);
    if (!valor) return;
    corregirLote({ bidIncrement: valor }, `Incremento cambiado a ${pesos(valor)}.`, () => setNuevoIncremento(''));
  };

  const cambiarMinima = (e: FormEvent) => {
    e.preventDefault();
    const valor = leerMonto(nuevaMinima);
    if (!valor) return;
    corregirLote({ nextMinBid: valor }, `Próxima oferta mínima fijada en ${pesos(valor)}.`, () => setNuevaMinima(''));
  };

  const minimaAutomatica = () =>
    corregirLote({ nextMinBid: null }, 'La oferta mínima vuelve a ser precio actual + incremento.', () => setNuevaMinima(''));

  const cambiarLider = (e: FormEvent) => {
    e.preventDefault();
    if (!nuevoLider) return;
    const leaderId = nuevoLider === 'nadie' ? null : nuevoLider;
    if (!window.confirm(`¿Dejar a ${nombreDe(leaderId)} como quien va ganando el lote?`)) return;
    corregirLote({ leaderId }, `Ahora va ganando: ${nombreDe(leaderId)}.`, () => setNuevoLider(''));
  };

  const anularPuja = (b: BidApi) => {
    const quien = `${b.user.firstName} ${b.user.lastName}`;
    if (
      !window.confirm(
        `¿Anular la oferta de ${quien} por ${pesos(b.amount)}? El precio y quién va ganando se recalculan con la mejor oferta que quede.`
      )
    )
      return;
    accion(async () => {
      await api.post(`/subastas/${id}/pujas/${b.id}/anular`);
      await cargarPujas();
    }, `Oferta de ${quien} anulada.`);
  };

  const quitarSancion = (s: SanctionApi) => {
    const quien = `${s.user.firstName} ${s.user.lastName}`;
    if (!window.confirm(`¿Quitar la sanción a ${quien}?`)) return;
    accion(async () => {
      await api.delete(`/subastas/${id}/sanciones/${s.id}`);
      await cargarSanciones();
    }, `Sanción quitada a ${quien}.`);
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
  const camaraPrendida = state?.auction.cameraOn ?? auction?.cameraOn ?? false;

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
                  <span className={styles.label}>Próxima puja mínima{minimaManual ? ' (a mano)' : ''}</span>
                  <span className={styles.precio}>{pesos(lotActual.minNextBid)}</span>
                </div>
              </div>
              <p className={styles.nota}>
                Va ganando: <strong>{nombreDe(lotActual.leaderId)}</strong> · Incremento {pesos(lotActual.bidIncrement)}
              </p>

              <div className={styles.acciones}>
                <button className={styles.btnNegro} onClick={adjudicar} disabled={busy || !lotActual.leaderId}>
                  Adjudicar lote al mejor postor
                </button>
                <button className={styles.btnGris} onClick={siguienteLote} disabled={busy}>
                  Siguiente lote
                </button>
              </div>

              {/* Correcciones en vivo (ej: alguien que oferta en joda) */}
              <h3>Corregir en vivo</h3>
              <form className={styles.correccion} onSubmit={cambiarPrecio}>
                <label className={styles.label} htmlFor="corr-precio">Precio actual</label>
                <input
                  id="corr-precio"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={pesos(lotActual.currentPrice)}
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  maxLength={15}
                />
                <button className={styles.btnChico} type="submit" disabled={busy || leerMonto(nuevoPrecio) == null}>
                  Cambiar
                </button>
              </form>
              <form className={styles.correccion} onSubmit={cambiarIncremento}>
                <label className={styles.label} htmlFor="corr-incremento">Incremento</label>
                <input
                  id="corr-incremento"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={pesos(lotActual.bidIncrement)}
                  value={nuevoIncremento}
                  onChange={(e) => setNuevoIncremento(e.target.value)}
                  maxLength={15}
                />
                <button className={styles.btnChico} type="submit" disabled={busy || !leerMonto(nuevoIncremento)}>
                  Cambiar
                </button>
              </form>
              <form className={styles.correccion} onSubmit={cambiarMinima}>
                <label className={styles.label} htmlFor="corr-minima">Próxima oferta mínima</label>
                <input
                  id="corr-minima"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={pesos(lotActual.minNextBid)}
                  value={nuevaMinima}
                  onChange={(e) => setNuevaMinima(e.target.value)}
                  maxLength={15}
                />
                <button className={styles.btnChico} type="submit" disabled={busy || !leerMonto(nuevaMinima)}>
                  Fijar
                </button>
                {minimaManual && (
                  <button className={styles.btnChico} type="button" onClick={minimaAutomatica} disabled={busy}>
                    Volver al automático
                  </button>
                )}
              </form>
              <form className={styles.correccion} onSubmit={cambiarLider}>
                <label className={styles.label} htmlFor="corr-lider">Va ganando</label>
                <select
                  id="corr-lider"
                  className={styles.input}
                  value={nuevoLider}
                  onChange={(e) => setNuevoLider(e.target.value)}
                >
                  <option value="">{nombreDe(lotActual.leaderId)}</option>
                  {postores
                    .filter((p) => p.userId !== lotActual.leaderId)
                    .map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.nombre}
                      </option>
                    ))}
                  {lotActual.leaderId && <option value="nadie">Nadie</option>}
                </select>
                <button className={styles.btnChico} type="submit" disabled={busy || !nuevoLider}>
                  Cambiar
                </button>
              </form>

              <h3>Pujas del lote</h3>
              {bids.length === 0 ? (
                <p className={styles.vacio}>Todavía no hay pujas.</p>
              ) : (
                <ul className={styles.bids}>
                  {bids.slice(0, 20).map((b) => (
                    <li
                      key={b.id}
                      className={
                        b.voidedAt
                          ? styles.bidAnulada
                          : b.userId === lotActual.leaderId && Number(b.amount) === lotActual.currentPrice
                            ? styles.bidMejor
                            : ''
                      }
                    >
                      <span>{b.user.firstName} {b.user.lastName}</span>
                      <strong>{pesos(b.amount)}</strong>
                      <span className={styles.hora}>{hora(b.createdAt)}</span>
                      {b.voidedAt ? (
                        <span className={styles.hora}>Anulada</span>
                      ) : (
                        <button className={styles.btnChico} onClick={() => anularPuja(b)} disabled={busy}>
                          Anular
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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
              camaraPrendida={camaraPrendida}
              token={token}
              placeholder={<div className={styles.sinVideo}>Sin cámara</div>}
            />
          </div>
          {stream?.mode === 'obs' ? (
            camaraPrendida && stream.streamKey ? (
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
                  servidor y la clave, y tocá <strong>Iniciar transmisión</strong>. Si la subasta está próxima, se abre sola cuando empezás a
                  transmitir (desde 2 h antes del horario). No compartas la clave: quien la tenga puede transmitir en
                  esta subasta.
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
          ) : camaraPrendida ? (
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

      {/* Moderación: los que el martillero silenció o expulsó desde el chat */}
      <section className={styles.card}>
        <h2>Sancionados en este remate</h2>
        <p className={styles.nota}>
          Desde el chat de la sala podés silenciar (no escribe más) o expulsar (no oferta ni escribe) a alguien. Vale solo
          para este remate.
        </p>
        {sanciones.length === 0 ? (
          <p className={styles.vacio}>Nadie sancionado.</p>
        ) : (
          <ul className={styles.bids}>
            {sanciones.map((s) => (
              <li key={s.id}>
                <span>{s.user.firstName} {s.user.lastName}</span>
                <strong>{SANCIONES[s.type]}</strong>
                <span className={styles.hora}>{hora(s.createdAt)}</span>
                <button className={styles.btnChico} onClick={() => quitarSancion(s)} disabled={busy}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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

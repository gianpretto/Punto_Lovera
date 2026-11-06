import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import LivePlayer from "../../components/LivePlayer/LivePlayer";
import Boton from "../../components/ui/Boton";
import Etiqueta from "../../components/ui/Etiqueta";
import Aviso from "../../components/ui/Aviso";
import VisorLote from "../../components/lotes/VisorLote";
import {
  partirDescripcion,
  type LoteCatalogo,
} from "../../components/lotes/lote";
import { useAuth } from "../../services/AuthContext";
import { api, ApiError, getToken, uploadUrl } from "../../services/api";
import { useAuctionRoom } from "../../services/useAuctionRoom";
import styles from "./SubastaActiva.module.scss";
import { registrarEvento } from '../../services/analytics';
import { NOMBRES_MARTILLEROS } from '../../content/martilleros';

// Sala en vivo (wireframes 620:14277 escritorio y 620:16312 / 620:16356
// celular, con el lenguaje visual del rediseño): video con el precio
// actual, panel para ofertar, lote en remate (abre el visor de fotos del
// catálogo), historial de ofertas y chat. Toda la lógica de la sala vive en
// useAuctionRoom; acá solo se presenta.

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

/** Cuánto tiempo queda visible el aviso de "¡Adjudicado!" */
const AVISO_ADJUDICADO_MS = 10_000;

type AvisoSala = { texto: string; donde: "puja" | "chat" };

export default function SubastaActiva() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  // Pase de invitado (link temporal del martillero): mirar sin cuenta
  const pase = user ? null : searchParams.get("pase");
  const invitado = !user && Boolean(pase);
  const aquiMismo = `/subastas/${id}/activa`;

  // Errores de puja y de chat: se muestran junto a lo último que se usó
  const [aviso, setAviso] = useState<AvisoSala | null>(null);
  const ultimaAccion = useRef<"puja" | "chat">("puja");

  // Con sesión se puja/chatea; sin sesión se mira como espectador
  const {
    state,
    messages,
    error,
    authRequired,
    placeBid,
    sendMessage: emitMessage,
  } = useAuctionRoom(
    id,
    user ? getToken() : null,
    {
      onError: (message) =>
        setAviso({ texto: message, donde: ultimaAccion.current }),
    },
    pase,
  );

  // Ingresar al remate (diagrama): sin cuenta ni pase → registrarse
  useEffect(() => {
    if (!loading && !user && !pase)
      navigate(`/registro?volver=${encodeURIComponent(aquiMismo)}`);
  }, [loading, user, pase, navigate, aquiMismo]);

  const lot = state?.lot ?? null;
  const auction = state?.auction ?? null;
  const esMartillero = user?.role === "MARTILLERO" || user?.role === "ADMIN";
  const paseVencido = invitado && authRequired;
  const minNextBid = lot?.minNextBid ?? 0;
  const increment = lot?.bidIncrement ?? 0;

  const [currentBid, setCurrentBid] = useState(0);
  // Crédito para pujar: lo disponible (saldo - reservas). Si ya va ganando
  // este lote, su reserva en este lote se reemplaza con la nueva puja, así
  // que también cuenta para la validación.
  const userCredits = user?.availableCredit ?? 0;
  const vaGanando = Boolean(user && lot?.leaderId === user.id);
  const creditoParaEsteLote =
    userCredits + (vaGanando && lot ? lot.currentPrice : 0);
  const [visorAbierto, setVisorAbierto] = useState(false);
  const cerrarVisor = useCallback(() => setVisorAbierto(false), []);
  const [newMessage, setNewMessage] = useState("");
  const [reenvio, setReenvio] = useState<"idle" | "enviando" | "enviado">(
    "idle",
  );

  // "Te superaron": iba ganando este lote y otro ofertó más
  const [superado, setSuperado] = useState(false);
  const liderAnterior = useRef<{
    lotId: string | null;
    leaderId: string | null;
  }>({ lotId: null, leaderId: null });
  useEffect(() => {
    const previo = liderAnterior.current;
    const mismoLote = previo.lotId === (lot?.id ?? null);
    if (!mismoLote) setSuperado(false);
    else if (
      user &&
      previo.leaderId === user.id &&
      lot?.leaderId &&
      lot.leaderId !== user.id
    )
      setSuperado(true);
    else if (vaGanando) setSuperado(false);
    liderAnterior.current = {
      lotId: lot?.id ?? null,
      leaderId: lot?.leaderId ?? null,
    };
  }, [lot?.id, lot?.leaderId, user, vaGanando]);

  // Cada puja o cambio de lote puede reservar/liberar crédito: refrescamos
  // el saldo disponible del usuario
  useEffect(() => {
    if (user) refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot?.id, lot?.currentPrice]);

  // Cambió el lote en remate: cerrar el visor y limpiar el aviso de puja
  useEffect(() => {
    setVisorAbierto(false);
    setAviso((a) => (a?.donde === "puja" ? null : a));
  }, [lot?.id]);

  // Si alguien pujó y la oferta que estaba armando quedó por debajo del
  // mínimo, la subimos al mínimo nuevo
  useEffect(() => {
    setCurrentBid((v) => (v < minNextBid ? minNextBid : v));
  }, [minNextBid]);

  // Cambió el precio: el error de puja anterior (p. ej. "la oferta mínima
  // es ...") ya no aplica
  useEffect(() => {
    setAviso((a) => (a?.donde === "puja" ? null : a));
  }, [lot?.currentPrice]);

  // Último "¡Adjudicado!" (lo agrega useAuctionRoom al recibir lot:sold)
  const adjudicacion = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m.id && m.user === "Martillero" && m.text.startsWith("¡Adjudicado"))
        return { clave: i, texto: m.text };
    }
    return null;
  }, [messages]);
  const [adjudicacionVisible, setAdjudicacionVisible] = useState<number | null>(
    null,
  );
  useEffect(() => {
    if (!adjudicacion) return;
    setAdjudicacionVisible(adjudicacion.clave);
    const t = setTimeout(
      () => setAdjudicacionVisible(null),
      AVISO_ADJUDICADO_MS,
    );
    return () => clearTimeout(t);
  }, [adjudicacion]);

  // Historial de ofertas: los mensajes de oferta del chat, el más nuevo arriba
  const ofertas = useMemo(
    () =>
      messages
        .filter((m) => m.isOffer)
        .slice(-8)
        .reverse(),
    [messages],
  );
  const miNombre = user ? `${user.firstName} ${user.lastName}` : null;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const formattedBid = currentBid.toLocaleString("es-AR");

  const onBidInputChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    setCurrentBid(numericValue ? parseInt(numericValue, 10) : 0);
  };

  const increaseBid = () => setCurrentBid((v) => v + increment);
  const decreaseBid = () =>
    setCurrentBid((v) => (v - increment >= minNextBid ? v - increment : v));

  const onlyNumbers = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !/[0-9]/.test(event.key)
    ) {
      event.preventDefault();
    }
  };

  const errorPuja = (texto: string) => setAviso({ texto, donde: "puja" });

  const reenviarVerificacion = () => {
    if (!user) return;
    setReenvio("enviando");
    api
      .post("/auth/resend-verification", { email: user.email })
      .then(() => setReenvio("enviado"))
      .catch((err) => {
        setReenvio("idle");
        errorPuja(
          err instanceof ApiError
            ? err.message
            : "No se pudo reenviar el mail.",
        );
      });
    // Por si ya lo verificó en otra pestaña: el próximo click ya lo toma
    refreshUser();
  };

  const placeOffer = () => {
    const amount = currentBid;
    ultimaAccion.current = "puja";
    setAviso(null);

    // Las reglas de ingreso (sesión, mail verificado, datos y crédito) se
    // muestran antes en el panel; acá se vuelven a validar por las dudas.
    if (!user) {
      navigate(`/registro?volver=${encodeURIComponent(aquiMismo)}`);
      return;
    }
    if (!user.emailVerified) {
      errorPuja(
        "Verificá tu mail para poder ofertar: revisá tu casilla (y la carpeta de spam).",
      );
      refreshUser();
      return;
    }
    if (!user.profileComplete) {
      navigate(`/datos?volver=${encodeURIComponent(aquiMismo)}`);
      return;
    }
    if (creditoParaEsteLote <= 0) {
      navigate("/creditos");
      return;
    }

    if (!lot) {
      errorPuja("No hay ningún lote en remate en este momento.");
      return;
    }

    if (!amount || amount <= 0) {
      errorPuja("Ingresá un monto válido.");
      return;
    }

    if (amount > creditoParaEsteLote) {
      errorPuja(
        `No tenés crédito suficiente para esta oferta (disponible: ${pesos(creditoParaEsteLote)}).`,
      );
      return;
    }

    if (amount < minNextBid) {
      errorPuja(`La oferta mínima es ${pesos(minNextBid)}.`);
      return;
    }

    // La confirmación llega por el socket (bid:new + mensaje en el chat)
    placeBid(lot.id, amount);
    registrarEvento('oferta');
  };

  const sendMessage = () => {
    ultimaAccion.current = "chat";
    if (!newMessage.trim()) return;
    if (!user) {
      setAviso({
        texto: "Como invitado podés leer el chat, pero no escribir.",
        donde: "chat",
      });
      return;
    }
    setAviso((a) => (a?.donde === "chat" ? null : a));
    // El mensaje vuelve por el socket a toda la sala (incluido uno mismo)
    emitMessage(newMessage);
    setNewMessage("");
  };

  const onChatKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---------- Datos para mostrar

  const imagenes = lot ? lot.images.map(uploadUrl) : [];
  const loteVisor: LoteCatalogo | null = lot
    ? {
        id: lot.id,
        numero: lot.number,
        titulo: lot.title,
        ...partirDescripcion(lot.description),
        etiqueta: `PRECIO ACTUAL ${pesos(lot.currentPrice)}`,
        imagenes,
      }
    : null;
  const descripcion = lot ? partirDescripcion(lot.description) : null;

  /** Texto del estado de la sala cuando no hay lote para mostrar */
  const mensajeSala = paseVencido
    ? "Este link de invitado venció o fue revocado."
    : !state
      ? (error ?? "Conectando con la sala…")
      : auction?.status === "FINALIZADA"
        ? "La subasta finalizó. ¡Gracias por participar!"
        : auction?.status === "CANCELADA"
          ? "La subasta fue cancelada."
          : "No quedan lotes en remate.";

  const pastilla =
    auction?.status === "ACTIVA" || !auction
      ? { texto: "En vivo", activa: true }
      : auction.status === "PROXIMA"
        ? { texto: "Próximamente", activa: false }
        : {
            texto: auction.status === "FINALIZADA" ? "Finalizada" : "Cancelada",
            activa: false,
          };

  /** Qué le falta al usuario para poder ofertar (reglas de ingreso) */
  const renderRequisito = () => {
    if (paseVencido) {
      return (
        <Requisito
          titulo="El link de invitado ya no es válido"
          texto="Pedile un link nuevo al martillero o creá tu cuenta para participar."
        >
          <Boton
            variante="verde"
            flecha
            to={`/registro?volver=${encodeURIComponent(aquiMismo)}`}
          >
            Crear mi cuenta
          </Boton>
        </Requisito>
      );
    }
    if (!user) {
      return (
        <Requisito
          titulo="Estás mirando como invitado"
          texto="Podés ver la transmisión y leer el chat. Para ofertar necesitás una cuenta."
        >
          <Boton
            variante="verde"
            flecha
            to={`/registro?volver=${encodeURIComponent(aquiMismo)}`}
          >
            Crear cuenta para ofertar
          </Boton>
        </Requisito>
      );
    }
    if (!user.emailVerified) {
      return (
        <Requisito
          titulo="Verificá tu mail para ofertar"
          texto="Te mandamos un link de confirmación: revisá tu casilla (y la carpeta de spam)."
        >
          {reenvio === "enviado" ? (
            <p className={styles.requisitoOk} role="status">
              Listo, te reenviamos el mail. Cuando confirmes tu cuenta vas a
              poder ofertar.
            </p>
          ) : (
            <Boton
              variante="verde"
              onClick={reenviarVerificacion}
              disabled={reenvio === "enviando"}
            >
              {reenvio === "enviando" ? "Reenviando…" : "Reenviar el mail"}
            </Boton>
          )}
        </Requisito>
      );
    }
    if (!user.profileComplete) {
      return (
        <Requisito
          titulo="Completá tus datos para ofertar"
          texto="Antes de tu primera oferta necesitamos tus datos personales."
        >
          <Boton
            variante="verde"
            flecha
            to={`/datos?volver=${encodeURIComponent(aquiMismo)}`}
          >
            Completar mis datos
          </Boton>
        </Requisito>
      );
    }
    if (creditoParaEsteLote <= 0) {
      return (
        <Requisito
          titulo="No tenés crédito disponible"
          texto="Cargá crédito para poder ofertar en este remate."
        >
          <Boton variante="verde" flecha to="/creditos">
            Cargar crédito
          </Boton>
        </Requisito>
      );
    }
    return null;
  };

  const requisito = renderRequisito();
  const puedeOfertar = !requisito && Boolean(lot);

  return (
    <div className={styles.pagina}>
      <div className={styles.contenedor}>
        {/* ---------- Cabecera */}
        <header className={styles.cabecera}>
          <nav className={styles.migas} aria-label="Ubicación">
            <Link to="/">Inicio</Link> / <Link to="/subastas">Subastas</Link> /{" "}
            {id && (
              <Link to={`/subastas/${id}`}>{auction?.title ?? "Catálogo"}</Link>
            )}
          </nav>

          {/* Cabecera compacta: el video y el panel para ofertar tienen que
              entrar juntos en la pantalla sin bajar */}
          <div className={styles.cabeceraFila}>
            <div className={styles.cabeceraTexto}>
              <div className={styles.filaTitulo}>
                <span
                  className={`${styles.pastilla} ${pastilla.activa ? styles.pastillaVivo : ""}`}
                >
                  {pastilla.activa && (
                    <span className={styles.puntoVivo} aria-hidden="true" />
                  )}
                  {pastilla.texto}
                </span>
                <h1 className={styles.titulo}>
                  {auction?.title ?? "Sala en vivo"}
                </h1>
              </div>
              {auction?.location && (
                <p className={styles.ubicacion}>
                  <img
                    src="/assets/figma/icono-ubicacion.svg"
                    alt=""
                    width={14}
                    height={14}
                  />
                  {auction.location}
                </p>
              )}
            </div>

            <div className={styles.cabeceraAcciones}>
              {esMartillero && (
                <Boton
                  variante="oscuro"
                  to={`/subastas/${id}/martillero`}
                  flecha
                >
                  Panel del martillero
                </Boton>
              )}
              {id && (
                <Boton variante="contorno" to={`/subastas/${id}`}>
                  Ver catálogo
                </Boton>
              )}
            </div>
          </div>
        </header>

        {/* ---------- Escenario: video + panel para ofertar a la izquierda,
            chat a la derecha con la misma altura. Pensado para que en una
            pantalla de escritorio se vea todo junto sin scrollear. */}
        <div className={styles.escenario}>
          <div className={styles.principal}>
            <section className={styles.video} aria-label="Transmisión en vivo">
              {id && (
                <LivePlayer
                  auctionId={id}
                  cameraId={auction?.cameraId ?? null}
                  token={user ? getToken() : null}
                  pase={pase}
                  placeholder={
                    <div className={styles.sinVideo}>
                      <svg
                        width="56"
                        height="56"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.2}
                        aria-hidden="true"
                      >
                        <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" />
                        <rect x="3" y="6" width="12" height="12" rx="1" />
                      </svg>
                      <p className={styles.sinVideoTitulo}>
                        La cámara está apagada
                      </p>
                      <p className={styles.sinVideoTexto}>
                        El video aparece solo cuando el martillero empiece a
                        transmitir.
                      </p>
                    </div>
                  }
                />
              )}

              <p className={styles.martilleros}>
                <span className={styles.martillerosLabel}>Martilleros</span>
                <span>{NOMBRES_MARTILLEROS}</span>
              </p>

              {adjudicacion && adjudicacionVisible === adjudicacion.clave && (
                <p className={styles.adjudicado} role="status">
                  <img
                    src="/assets/figma/icono-martillo.svg"
                    alt=""
                    width={18}
                    height={18}
                  />
                  {adjudicacion.texto}
                </p>
              )}

              {lot && (
                <p className={styles.seVende}>
                  <span className={styles.seVendeLote}>Lote {lot.number}</span>
                  <span>
                    Se vende en <strong>{pesos(lot.currentPrice)}</strong>
                  </span>
                </p>
              )}
            </section>

            {/* ---------- Panel para ofertar (barra debajo del video) */}
            <section
              className={styles.ofertar}
              aria-labelledby="titulo-ofertar"
            >
              <div className={styles.ofertarInfo}>
                <div className={styles.ofertarCabecera}>
                  <h2 id="titulo-ofertar" className={styles.ofertarTitulo}>
                    {lot ? `Lote ${lot.number} · ${lot.title}` : "Lote en remate"}
                  </h2>
                  {vaGanando && (
                    <span
                      className={`${styles.estadoPuja} ${styles.ganando}`}
                      role="status"
                    >
                      ✓ Vas ganando
                    </span>
                  )}
                  {!vaGanando && superado && (
                    <span
                      className={`${styles.estadoPuja} ${styles.superado}`}
                      role="status"
                    >
                      Te superaron
                    </span>
                  )}
                </div>

                {lot ? (
                  <dl className={styles.precios}>
                    <div>
                      <dt>Precio actual</dt>
                      <dd className={styles.precioActual}>
                        {pesos(lot.currentPrice)}
                      </dd>
                    </div>
                    <div>
                      <dt>Oferta mínima</dt>
                      <dd>{pesos(minNextBid)}</dd>
                    </div>
                    <div>
                      <dt>Incremento</dt>
                      <dd>{pesos(increment)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className={styles.salaMensaje} role="status">
                    {mensajeSala}
                  </p>
                )}
              </div>

              <div className={styles.ofertarAccion}>
                {requisito}

                {!requisito && lot && (
                  <div className={styles.pujaFila}>
                    <div className={styles.selector}>
                      <button
                        type="button"
                        className={styles.paso}
                        onClick={decreaseBid}
                        disabled={
                          !puedeOfertar || currentBid - increment < minNextBid
                        }
                        aria-label={`Bajar ${pesos(increment)}`}
                      >
                        −
                      </button>
                      <div className={styles.monto}>
                        <label
                          htmlFor="monto-oferta"
                          className={styles.montoLabel}
                        >
                          Tu oferta
                        </label>
                        <div className={styles.montoCampo}>
                          <span aria-hidden="true">$</span>
                          <input
                            id="monto-oferta"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            className={styles.montoInput}
                            value={formattedBid}
                            style={{
                              width: `${Math.max(formattedBid.length, 1) + 0.5}ch`,
                            }}
                            onChange={(e) => onBidInputChange(e.target.value)}
                            onKeyDown={onlyNumbers}
                            disabled={!puedeOfertar}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.paso}
                        onClick={increaseBid}
                        disabled={!puedeOfertar}
                        aria-label={`Subir ${pesos(increment)}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className={styles.botonOfertar}
                      onClick={placeOffer}
                      disabled={!puedeOfertar}
                    >
                      Ofertar
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                )}

                {user && (
                  <p className={styles.creditos}>
                    Tus créditos: <strong>{pesos(userCredits)}</strong>
                    {vaGanando && lot && (
                      <span>
                        {" "}
                        · {pesos(lot.currentPrice)} reservados en este lote
                      </span>
                    )}
                  </p>
                )}
              </div>

              {aviso?.donde === "puja" && (
                <Aviso tipo="error" className={styles.aviso}>
                  {aviso.texto}
                </Aviso>
              )}
            </section>
          </div>

          {/* ---------- Chat, alineado con el video y la barra de ofertar */}
          <aside className={styles.lateral}>
            <section className={styles.chat} aria-labelledby="titulo-chat">
              <h2 id="titulo-chat" className={styles.chatTitulo}>
                Chat en vivo{" "}
                <span className={styles.puntoVivo} aria-hidden="true" />
              </h2>
              <div
                className={styles.chatMensajes}
                ref={scrollRef}
                aria-live="polite"
                aria-relevant="additions"
              >
                {messages.length === 0 && (
                  <p className={styles.vacio}>Todavía no hay mensajes.</p>
                )}
                {messages.map((msg, i) => (
                  <p
                    className={`${styles.mensaje} ${msg.isOffer ? styles.mensajeOferta : ""} ${!msg.id ? styles.mensajeSistema : ""}`}
                    key={msg.id ?? `local-${i}`}
                  >
                    <span className={styles.mensajeUsuario}>{msg.user}</span>
                    <span className={styles.mensajeTexto}>{msg.text}</span>
                    <span className={styles.mensajeHora}>{msg.time}</span>
                  </p>
                ))}
              </div>
              {aviso?.donde === "chat" && (
                <Aviso tipo="error" className={styles.avisoChat}>
                  {aviso.texto}
                </Aviso>
              )}
              <div className={styles.chatEntrada}>
                <label htmlFor="mensaje-chat" className={styles.oculto}>
                  Tu mensaje
                </label>
                <input
                  id="mensaje-chat"
                  type="text"
                  placeholder={
                    user ? "Tu mensaje…" : "Solo lectura como invitado"
                  }
                  value={newMessage}
                  maxLength={500}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={onChatKeyDown}
                  disabled={!user}
                />
                <button
                  type="button"
                  className={styles.enviar}
                  onClick={sendMessage}
                  disabled={!user}
                  aria-label="Enviar mensaje"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </section>
          </aside>
        </div>

        {/* ---------- Debajo: detalle del lote en remate y últimas ofertas */}
        <div className={styles.inferior}>
          {lot && (
            <section className={styles.lote} aria-labelledby="titulo-lote">
              <div className={styles.loteMedia}>
                {imagenes.length > 0 ? (
                  <button
                    type="button"
                    className={styles.loteFotoBoton}
                    onClick={() => setVisorAbierto(true)}
                    aria-label={`Ampliar fotos de ${lot.title}`}
                  >
                    <img className={styles.loteFoto} src={imagenes[0]} alt="" />
                    {imagenes.length > 1 && (
                      <span className={styles.loteCantidad}>
                        {imagenes.length} fotos
                      </span>
                    )}
                  </button>
                ) : (
                  <span className={styles.sinFotos}>Sin fotos todavía</span>
                )}
              </div>
              <div className={styles.loteCuerpo}>
                <p className={styles.loteEtiquetas}>
                  <span>Lote {lot.number}</span>
                  <span>Base {pesos(lot.startingPrice)}</span>
                </p>
                <h2 id="titulo-lote" className={styles.loteTitulo}>
                  {lot.title}
                </h2>
                {descripcion?.resumen && (
                  <p className={styles.loteResumen}>{descripcion.resumen}</p>
                )}
                <button
                  type="button"
                  className={styles.verFotos}
                  onClick={() => setVisorAbierto(true)}
                >
                  <span>
                    {imagenes.length > 0 ? "Ver fotos y detalle" : "Ver detalle"}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}

          <section
            className={styles.historial}
            aria-labelledby="titulo-historial"
          >
            <Etiqueta className={styles.etiquetaSeccion}>
              Últimas ofertas
            </Etiqueta>
            <h2 id="titulo-historial" className={styles.oculto}>
              Últimas ofertas
            </h2>
            {ofertas.length === 0 ? (
              <p className={styles.vacio}>
                Todavía no hay ofertas. ¡Podés ser el primero!
              </p>
            ) : (
              <ol className={styles.historialLista}>
                {ofertas.map((o, i) => (
                  <li
                    key={o.id ?? `o-${i}`}
                    className={`${styles.historialItem} ${i === 0 ? styles.historialPrimero : ""}`}
                  >
                    <span className={styles.historialQuien}>
                      {o.user}
                      {miNombre === o.user && (
                        <span className={styles.vos}> (vos)</span>
                      )}
                    </span>
                    <span className={styles.historialMonto}>
                      {o.text.replace(/^ofreció\s*/, "")}
                    </span>
                    <span className={styles.historialHora}>{o.time}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {visorAbierto && loteVisor && (
        <VisorLote lote={loteVisor} onCerrar={cerrarVisor} />
      )}
    </div>
  );
}

/** Lo que le falta al usuario para ofertar, con el botón para resolverlo. */
function Requisito({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.requisito}>
      <div>
        <p className={styles.requisitoTitulo}>{titulo}</p>
        <p className={styles.requisitoTexto}>{texto}</p>
      </div>
      <div className={styles.requisitoAccion}>{children}</div>
    </div>
  );
}

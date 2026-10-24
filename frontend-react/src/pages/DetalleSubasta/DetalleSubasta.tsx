import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  countdownTo,
  formatFecha,
  formatHora,
  lotImages,
  useAuction,
  useNow,
  type AuctionDetailApi,
  type LotApi,
} from '../../services/auctions';
import { uploadUrl } from '../../services/api';
import { useAuth, type User } from '../../services/AuthContext';
import Boton from '../../components/ui/Boton';
import Etiqueta from '../../components/ui/Etiqueta';
import TarjetaLote from '../../components/lotes/TarjetaLote';
import VisorLote from '../../components/lotes/VisorLote';
import { partirDescripcion, type LoteCatalogo } from '../../components/lotes/lote';
import styles from './DetalleSubasta.module.scss';

// Catálogo de una subasta (Figma "catalogo"): cabecera con datos, foto y
// cuenta regresiva, grilla de lotes (cada uno abre el visor de fotos) y la
// banda "Información importante". Datos reales de GET /api/subastas/:id.

const FOTO_DEFAULT = '/assets/figma/subasta-cafeteria.webp';

const PASOS = [
  {
    titulo: 'Revisá el lote',
    texto: 'Las fotografías y descripciones son orientativas. Podés coordinar una visita.',
  },
  {
    titulo: 'Consultá los costos',
    texto: 'La comisión y las condiciones se informan antes de confirmar la oferta.',
  },
  {
    titulo: 'Coordiná el retiro',
    texto: 'Los bienes deben retirarse en el plazo indicado luego de completar el pago.',
  },
];

const precio = (valor: string | undefined) =>
  valor ? `$ ${Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '';

function aLoteCatalogo(lot: LotApi): LoteCatalogo {
  return {
    id: lot.id,
    numero: lot.number,
    titulo: lot.title,
    ...partirDescripcion(lot.description),
    etiqueta: lot.sold ? 'VENDIDO' : lot.startingPrice ? `BASE ${precio(lot.startingPrice)}` : '',
    imagenes: lotImages(lot),
  };
}

/** "En 18 días.", "En 5 horas.", etc. (columna CIERRE del diseño) */
function textoCierre(auction: AuctionDetailApi, now: number) {
  if (auction.status === 'ACTIVA') return 'En curso.';
  if (auction.status === 'FINALIZADA') return 'Finalizada.';
  if (auction.status === 'CANCELADA') return 'Cancelada.';
  const ms = new Date(auction.startsAt).getTime() - now;
  const dias = Math.floor(ms / 86_400_000);
  const horas = Math.floor(ms / 3_600_000);
  if (dias >= 2) return `En ${dias} días.`;
  if (dias === 1) return 'En 1 día.';
  if (horas >= 1) return `En ${horas} ${horas === 1 ? 'hora' : 'horas'}.`;
  return ms > 0 ? 'En minutos.' : 'Por empezar.';
}

interface Accion {
  texto: string;
  to?: string;
  nota?: string;
}

/**
 * Botón de la cabecera según las reglas de ingreso (diagrama de flujo):
 * sin cuenta → registrarse; sin datos → perfil; sin crédito → cargar
 * crédito; con la subasta ACTIVA → entrar a la sala (con sesión o con el
 * pase de invitado `?pase=`). Pujar lo vuelve a validar la sala.
 */
function accionIngreso(auction: AuctionDetailApi, user: User | null, pase: string | null): Accion | null {
  const sala = `/subastas/${auction.id}/activa`;
  const aqui = `/subastas/${auction.id}`;
  if (auction.status === 'FINALIZADA' || auction.status === 'CANCELADA') return null;

  if (auction.status === 'ACTIVA') {
    if (user) return { texto: 'Ingresar al remate', to: sala };
    if (pase) return { texto: 'Ingresar al remate', to: `${sala}?pase=${encodeURIComponent(pase)}` };
    return { texto: 'Registrarme para ofertar', to: `/registro?volver=${encodeURIComponent(sala)}` };
  }

  if (!user) return { texto: 'Registrarme para ofertar', to: `/registro?volver=${encodeURIComponent(aqui)}` };
  if (!user.profileComplete) return { texto: 'Completar mis datos', to: `/datos?volver=${encodeURIComponent(aqui)}` };
  if (user.availableCredit <= 0) return { texto: 'Cargar crédito', to: '/creditos' };
  return {
    texto: '',
    nota: 'Ya estás listo para ofertar: la sala se abre cuando empiece la transmisión.',
  };
}

export default function DetalleSubasta() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { auction, error } = useAuction(id);
  const { user, loading } = useAuth();
  const now = useNow();
  const [visor, setVisor] = useState<{ lote: LoteCatalogo; foto: number } | null>(null);
  const cerrarVisor = useCallback(() => setVisor(null), []);

  const lotes = useMemo(() => (auction?.lots ?? []).map(aLoteCatalogo), [auction]);

  if (!auction) {
    return (
      <div className={`${styles.pagina} ${styles.conPatron}`}>
        <section className={`${styles.cabecera} ${styles.catalogo}`}>
          <div className={styles.contenedor}>
            <p className={styles.estadoCarga}>{error ? 'No encontramos esta subasta.' : 'Cargando subasta…'}</p>
            {error && (
              <Boton variante="verde" to="/subastas" flecha>
                Ver próximas subastas
              </Boton>
            )}
          </div>
        </section>
      </div>
    );
  }

  const estado = auction.status;
  const pastilla = estado === 'ACTIVA' ? 'ACTIVA' : estado === 'PROXIMA' ? 'PRÓXIMAMENTE' : estado;
  const cuenta = countdownTo(auction.startsAt, now);
  const accion = loading ? null : accionIngreso(auction, user, user ? null : searchParams.get('pase'));
  const ubicacion = auction.location.replace(/\.?\s*$/, '.');
  const tituloLargo = auction.title.length > 28;

  return (
    <div className={styles.pagina}>
      <div className={styles.conPatron}>
        <section className={styles.cabecera}>
          <div className={styles.contenedor}>
            <nav className={styles.migas} aria-label="Ubicación">
              <Link to="/">Inicio</Link> / <Link to="/subastas">Subastas</Link> / <span>{auction.title}</span>
            </nav>

            <div className={styles.cabeceraGrilla}>
              <div className={styles.datos}>
                <div className={styles.filaId}>
                  <Etiqueta tamano="grande" className={styles.etiquetaVerde}>
                    {`ID: ${auction.id.slice(0, 8).toUpperCase()}`}
                  </Etiqueta>
                  <span className={`${styles.pastilla} ${estado === 'ACTIVA' ? styles.pastillaActiva : ''}`}>
                    <img src="/assets/figma/icono-martillo.svg" alt="" width={19} height={19} />
                    {pastilla}
                  </span>
                </div>

                <h1 className={`${styles.titulo} ${tituloLargo ? styles.tituloLargo : ''}`}>{auction.title}</h1>
                {auction.description && <p className={styles.descripcion}>{auction.description}</p>}

                <dl className={styles.meta}>
                  <div className={styles.metaItem}>
                    <img src="/assets/figma/icono-ubicacion.svg" alt="" width={14} height={14} />
                    <div>
                      <dt>UBICACIÓN</dt>
                      <dd>{ubicacion}</dd>
                    </div>
                  </div>
                  <div className={styles.metaItem}>
                    <img src="/assets/figma/icono-calendario-verde.svg" alt="" width={17} height={17} />
                    <div>
                      <dt>FECHA</dt>
                      <dd>{`${formatFecha(auction.startsAt)}, ${formatHora(auction.startsAt)}.`}</dd>
                    </div>
                  </div>
                  <div className={styles.metaItem}>
                    <img src="/assets/figma/icono-reloj-verde.svg" alt="" width={16} height={16} />
                    <div>
                      <dt>CIERRE</dt>
                      <dd>{textoCierre(auction, now)}</dd>
                    </div>
                  </div>
                </dl>

                <div className={styles.accion}>
                  {accion?.to && (
                    <Boton variante="verde" to={accion.to} flecha className={styles.botonAccion}>
                      {accion.texto}
                    </Boton>
                  )}
                  {accion?.nota && <p className={styles.nota}>{accion.nota}</p>}
                </div>
              </div>

              <div className={styles.media}>
                <img
                  className={styles.foto}
                  src={auction.coverImageUrl ? uploadUrl(auction.coverImageUrl) : FOTO_DEFAULT}
                  alt=""
                />
                {estado === 'PROXIMA' ? (
                  <div className={styles.cuenta} role="timer" aria-label="Tiempo hasta el remate">
                    {(
                      [
                        ['d', 'D'],
                        ['h', 'H'],
                        ['m', 'M'],
                        ['s', 'S'],
                      ] as const
                    ).map(([k, label], i) => (
                      <div key={k} className={styles.cuentaGrupo}>
                        {i > 0 && <span className={styles.cuentaSeparador}>:</span>}
                        <span className={styles.cuentaUnidad}>
                          <span className={styles.cuentaNumero}>{cuenta[k]}</span>
                          <span className={styles.cuentaLabel}>{label}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`${styles.recuadro} ${estado === 'ACTIVA' ? styles.recuadroActiva : ''}`}>
                    {estado === 'ACTIVA' ? 'SUBASTA ACTIVA' : estado}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.catalogo} aria-labelledby="catalogo-titulo">
          <div className={styles.contenedor}>
            <Etiqueta tamano="grande" className={styles.etiquetaVerde}>
              catálogo de bienes
            </Etiqueta>
            <h2 id="catalogo-titulo" className={styles.cantidad}>
              {lotes.length === 0 ? 'Sin lotes todavía' : `${lotes.length} ${lotes.length === 1 ? 'lote' : 'lotes'}`}
            </h2>

            {lotes.length > 0 && (
              <div className={styles.grilla}>
                {lotes.map((lote) => (
                  <TarjetaLote key={lote.id} lote={lote} onVerFotos={(foto) => setVisor({ lote, foto })} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className={styles.informacion} aria-labelledby="informacion-titulo">
        <div className={`${styles.contenedor} ${styles.informacionGrilla}`}>
          <div>
            <Etiqueta tono="claro">ANTES DE OFERTAR</Etiqueta>
            <h2 id="informacion-titulo" className={styles.informacionTitulo}>
              Información
              <br />
              importante
            </h2>
          </div>
          <ol className={styles.pasos}>
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className={styles.paso}>
                <span className={styles.pasoNumero}>{`0${i + 1}.`}</span>
                <h3 className={styles.pasoTitulo}>{paso.titulo}</h3>
                <p className={styles.pasoTexto}>{paso.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {visor && <VisorLote lote={visor.lote} fotoInicial={visor.foto} onCerrar={cerrarVisor} />}
    </div>
  );
}

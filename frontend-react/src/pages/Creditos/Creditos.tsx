import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SeccionVender from '../../components/secciones/SeccionVender';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import Etiqueta from '../../components/ui/Etiqueta';
import EstadoPastilla from '../../components/ui/EstadoPastilla';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError, openProtectedFile } from '../../services/api';
import { useConfigCreditos } from '../../services/config';
import styles from './Creditos.module.scss';

// Créditos (wireframes 620:13189 escritorio / 620:15358 celular), en la
// línea visual del rediseño: banda verde con el crédito disponible, datos de
// transferencia + carga del comprobante, historial de cargas y reintegros,
// "Cómo cargar créditos" y la banda "¿Tenés bienes para vender?".
// No hay pasarela de pago: la app solo muestra los datos para transferir.

// Borrador armado a partir de cómo funciona el sistema: validar el texto con el cliente.
const instrucciones = [
  {
    icono: '/assets/figma/icono-comprar-pago.svg',
    titulo: '1. Transferí',
    desc: 'Hacé una transferencia por el monto que quieras usar para ofertar a la cuenta que figura arriba.',
  },
  {
    icono: '/assets/figma/icono-comprar-dinero.svg',
    titulo: '2. Cargá el comprobante',
    desc: 'Subí la foto o el PDF de la transferencia indicando el monto. Lo revisamos y te avisamos por mail.',
  },
  {
    icono: '/assets/figma/icono-comprar-garantia.svg',
    titulo: '3. Garantía al ofertar',
    desc: 'Mientras vas ganando un lote, el monto de tu oferta queda reservado. Si te superan, se libera; si ganás, se descuenta.',
  },
];

interface TransferInfo {
  alias: string;
  cbu: string;
  holder: string;
  cuit?: string;
  account: string;
}

type VoucherStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

interface Voucher {
  id: string;
  amount: string;
  status: VoucherStatus;
  rejectionReason: string | null;
  createdAt: string;
}

const ESTADO: Record<VoucherStatus, string> = {
  PENDIENTE: 'En revisión',
  APROBADO: 'Acreditado',
  RECHAZADO: 'Rechazado',
};

interface Withdrawal {
  id: string;
  amount: string;
  cbu: string;
  alias: string | null;
  status: VoucherStatus;
  rejectionReason: string | null;
  createdAt: string;
}

const ESTADO_REINTEGRO: Record<VoucherStatus, string> = {
  PENDIENTE: 'En trámite',
  APROBADO: 'Transferido',
  RECHAZADO: 'Rechazado',
};

// Ícono de carga (flecha hacia arriba sobre una bandeja), trazo verde como
// los íconos del diseño
const IconoSubir = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export default function Creditos() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  // Lo que puede usar para pujar (saldo - reservas de lotes que va ganando
  // y de reintegros pendientes)
  const creditoDisponible = user?.availableCredit ?? 0;
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [transfer, setTransfer] = useState<TransferInfo | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // Modo de créditos que eligió el admin (con crédito / sin crédito / garantía)
  const configCreditos = useConfigCreditos();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    api
      .get<{ transfer: TransferInfo }>('/creditos/transferencia')
      .then(({ transfer }) => setTransfer(transfer))
      .catch(() => setTransfer(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ vouchers: Voucher[] }>('/creditos/mios')
      .then(({ vouchers }) => setVouchers(vouchers))
      .catch(() => setVouchers([]));
    api
      .get<{ withdrawals: Withdrawal[] }>('/creditos/reintegros/mios')
      .then(({ withdrawals }) => setWithdrawals(withdrawals))
      .catch(() => setWithdrawals([]));
  }, [user]);

  const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVoucherFile(file);
      setError('');
      if (!file.type.startsWith('image/')) {
        setVoucherPreview(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setVoucherPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const montoNumero = Number(monto.replace(/\D/g, ''));

  const enviarComprobante = async () => {
    if (!voucherFile || sending) return;
    if (!montoNumero) {
      setError('Indicá el monto que transferiste.');
      return;
    }
    if (montoNumero > 9_999_999_999) {
      setError('El monto es demasiado grande.');
      return;
    }
    const form = new FormData();
    form.append('amount', String(montoNumero));
    form.append('comprobante', voucherFile);
    setSending(true);
    setError('');
    try {
      await api.post('/creditos', form);
      navigate('/comprobante-exitoso');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el comprobante.');
    } finally {
      setSending(false);
    }
  };

  const verComprobante = (id: string) =>
    openProtectedFile(`/creditos/${id}/archivo`).catch((err) =>
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el comprobante.')
    );

  return (
    <div className={styles.pagina}>
      {/* ---------- Banda verde: crédito disponible */}
      <section className={styles.saldo}>
        <div className={styles.saldoContenido}>
          <div>
            <Etiqueta tono="claro" tamano="grande">
              mis créditos
            </Etiqueta>
            <h1 className={styles.saldoTitulo}>Crédito disponible</h1>
            <p className={styles.saldoMonto}>$ {formatNumber(creditoDisponible)}</p>
          </div>
          <div className={styles.saldoLado}>
            <dl className={styles.saldoDetalle}>
              <div>
                <dt>Saldo total</dt>
                <dd>$ {formatNumber(user?.creditBalance ?? 0)}</dd>
              </div>
              <div>
                <dt>Reservado</dt>
                <dd>$ {formatNumber(user?.heldCredit ?? 0)}</dd>
              </div>
            </dl>
            <p className={styles.saldoNota}>Lo reservado corresponde a lotes que vas ganando y reintegros en trámite.</p>
          </div>
        </div>
      </section>

      <div className={styles.contenedor}>
        {/* ---------- Transferir + cargar comprobante */}
        <section className={styles.carga} aria-labelledby="titulo-carga">
          <Etiqueta tono="verde" tamano="grande">
            cargar crédito
          </Etiqueta>
          <h2 id="titulo-carga" className={styles.tituloSeccion}>
            Transferí y <em>subí el comprobante.</em>
          </h2>
          {configCreditos?.modo === 'SIN_CREDITO' && (
            <p className={styles.aviso}>
              Por ahora no hace falta cargar crédito para ofertar: el pago se arregla directamente con Punto Lovera.
            </p>
          )}
          {configCreditos?.modo === 'GARANTIA' && (
            <p className={styles.aviso}>
              Para ofertar alcanza con tener crédito por el {configCreditos.porcentajeGarantia} % de tu oferta, como
              garantía.
            </p>
          )}

          <div className={styles.cargaGrilla}>
            <div className={styles.datos}>
              <h3 className={styles.datosTitulo}>Transferir a:</h3>
              <dl className={styles.datosLista}>
                <div>
                  <dt>Alias</dt>
                  <dd>{transfer?.alias || '—'}</dd>
                </div>
                <div>
                  <dt>CBU</dt>
                  <dd>{transfer?.cbu || '—'}</dd>
                </div>
                {transfer?.account && (
                  <div>
                    <dt>Cuenta</dt>
                    <dd>{transfer.account}</dd>
                  </div>
                )}
                <div>
                  <dt>Nombre</dt>
                  <dd>{transfer?.holder || '—'}</dd>
                </div>
                {transfer?.cuit && (
                  <div>
                    <dt>CUIT/CUIL</dt>
                    <dd>{transfer.cuit}</dd>
                  </div>
                )}
              </dl>
              <p className={styles.datosNota}>La inscripción se hará efectiva una vez cargado el comprobante de pago.</p>
            </div>

            <div className={styles.subida}>
              <label className={`${styles.zona} ${voucherFile ? styles.zonaConArchivo : ''}`}>
                <input
                  className={styles.archivoOculto}
                  type="file"
                  onChange={onFileSelected}
                  accept="image/*,application/pdf"
                />
                {voucherPreview ? (
                  <img src={voucherPreview} alt="Vista previa del comprobante" className={styles.vistaPrevia} />
                ) : (
                  <span className={styles.zonaContenido}>
                    <IconoSubir />
                    <span className={styles.zonaTexto}>{voucherFile ? voucherFile.name : 'Cargar comprobante'}</span>
                    {!voucherFile && <span className={styles.zonaAyuda}>Imagen o PDF</span>}
                  </span>
                )}
                {voucherFile && <span className={styles.zonaCambiar}>Cambiar archivo</span>}
              </label>

              <Campo
                etiqueta="Monto transferido"
                inputMode="numeric"
                maxLength={16}
                placeholder="$ 0"
                value={montoNumero ? montoNumero.toLocaleString('es-AR') : monto.replace(/\D/g, '')}
                onChange={(e) => setMonto(e.target.value)}
              />

              {error && <Aviso tipo="error">{error}</Aviso>}

              <Boton
                variante="verde"
                flecha
                bloque
                onClick={enviarComprobante}
                disabled={!voucherFile || !montoNumero || sending}
              >
                {sending ? 'Enviando...' : 'Enviar comprobante'}
              </Boton>
            </div>
          </div>
        </section>

        {/* ---------- Historial */}
        {(vouchers.length > 0 || withdrawals.length > 0) && (
          <section className={styles.historial} aria-label="Historial">
            {vouchers.length > 0 && (
              <div className={styles.bloqueHistorial}>
                <h2 className={styles.tituloHistorial}>Informes de depósitos</h2>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Monto</th>
                      <th scope="col">Estado</th>
                      <th scope="col">
                        <span className={styles.soloLectores}>Comprobante</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map((v) => (
                      <tr key={v.id}>
                        <td data-titulo="Fecha">{formatFecha(v.createdAt)}</td>
                        <td data-titulo="Monto" className={styles.celdaMonto}>
                          $ {formatNumber(Number(v.amount))}
                        </td>
                        <td data-titulo="Estado">
                          <EstadoPastilla estado={v.status}>{ESTADO[v.status]}</EstadoPastilla>
                          {v.status === 'RECHAZADO' && v.rejectionReason && (
                            <p className={styles.motivo}>{v.rejectionReason}</p>
                          )}
                        </td>
                        <td className={styles.celdaAccion}>
                          <button type="button" className={styles.enlace} onClick={() => verComprobante(v.id)}>
                            Ver comprobante
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {withdrawals.length > 0 && (
              <div className={styles.bloqueHistorial}>
                <h2 className={styles.tituloHistorial}>Reintegros solicitados</h2>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Monto</th>
                      <th scope="col">Cuenta</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td data-titulo="Fecha">{formatFecha(w.createdAt)}</td>
                        <td data-titulo="Monto" className={styles.celdaMonto}>
                          $ {formatNumber(Number(w.amount))}
                        </td>
                        <td data-titulo="Cuenta">{w.alias || `CBU …${w.cbu.slice(-4)}`}</td>
                        <td data-titulo="Estado">
                          <EstadoPastilla estado={w.status}>{ESTADO_REINTEGRO[w.status]}</EstadoPastilla>
                          {w.status === 'RECHAZADO' && w.rejectionReason && (
                            <p className={styles.motivo}>{w.rejectionReason}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---------- Cómo cargar créditos */}
        <section className={styles.instrucciones} aria-labelledby="titulo-instrucciones">
          <h2 id="titulo-instrucciones" className={styles.tituloSeccion}>
            Cómo cargar <em>créditos</em>
          </h2>
          <ul className={styles.tarjetas}>
            {instrucciones.map((inst, i) => (
              <li className={styles.tarjeta} key={i}>
                <span className={styles.tarjetaNumero}>{String(i + 1).padStart(2, '0')}.</span>
                <img className={styles.tarjetaIcono} src={inst.icono} alt="" width={113} height={112} />
                <h3 className={styles.tarjetaTitulo}>{inst.titulo}</h3>
                <p className={styles.tarjetaTexto}>{inst.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Reintegro */}
        <div className={styles.reintegro}>
          <p className={styles.reintegroTexto}>¿Te quedó crédito sin usar?</p>
          <Boton variante="contorno" to="/reintegro" flecha>
            Solicitar reintegro
          </Boton>
        </div>
      </div>

      <SeccionVender origen="creditos" />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError, openProtectedFile } from '../../services/api';
import styles from './Creditos.module.scss';

// Borrador armado a partir de cómo funciona el sistema: validar el texto con el cliente.
const instrucciones = [
  {
    titulo: '1. Transferí',
    desc: 'Hacé una transferencia por el monto que quieras usar para ofertar a la cuenta que figura arriba.',
  },
  {
    titulo: '2. Cargá el comprobante',
    desc: 'Subí la foto o el PDF de la transferencia indicando el monto. Lo revisamos y te avisamos por mail.',
  },
  {
    titulo: '3. Garantía al ofertar',
    desc: 'Mientras vas ganando un lote, el monto de tu oferta queda reservado. Si te superan, se libera; si ganás, se descuenta.',
  },
];

interface TransferInfo {
  alias: string;
  cbu: string;
  holder: string;
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

const CardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth={1}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

export default function Creditos() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  // Lo que puede usar para pujar (saldo - reservas de lotes que va ganando)
  const creditoDisponible = user?.availableCredit ?? 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [transfer, setTransfer] = useState<TransferInfo | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

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
  }, [user]);

  const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

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
    <div className={styles.creditosWrapper}>
      <div className={styles.creditBanner}>
        <h2 className={styles.creditTitle}>Crédito disponible</h2>
        <div className={styles.creditAmount}>$ {formatNumber(creditoDisponible)}</div>
      </div>

      <div className={styles.uploadContainer}>
        <div className={styles.infoBox}>
          <h3>Transferir a:</h3>
          <div className={styles.infoDetails}>
            <p><strong>Alias:</strong> {transfer?.alias || '—'}</p>
            <p><strong>CBU:</strong> {transfer?.cbu || '—'}</p>
            {transfer?.account && <p><strong>Cuenta:</strong> {transfer.account}</p>}
            <p><strong>Nombre:</strong> {transfer?.holder || '—'}</p>
          </div>
          <p className={styles.infoNote}>La inscripción se hará efectiva una vez cargado el comprobante de pago.</p>
        </div>

        <div className={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
          {!voucherPreview && (
            <div className={styles.uploadContent}>
              <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>CARGAR COMPROBANTE</span>
            </div>
          )}
          {voucherPreview && (
            <img src={voucherPreview} alt="Comprobante" className={styles.voucherPreview} />
          )}
          {voucherFile && !voucherPreview && (
            <div className={styles.uploadContent}>
              <span>{voucherFile.name}</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileSelected}
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <input
          className={styles.montoInput}
          inputMode="numeric"
          placeholder="Monto transferido ($)"
          value={montoNumero ? montoNumero.toLocaleString('es-AR') : monto.replace(/\D/g, '')}
          onChange={(e) => setMonto(e.target.value)}
        />
        <button className={styles.btnBlack} onClick={enviarComprobante} disabled={!voucherFile || !montoNumero || sending}>
          Enviar Comprobante
        </button>
      </div>
      {error && <div className={styles.alertDanger}>{error}</div>}

      {vouchers.length > 0 && (
        <div className={styles.depositsSection}>
          <h2 className={styles.sectionTitle}>Informes de depósitos</h2>
          <div className={styles.tableResponsive}>
            <table className={styles.depositsTable}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td>{new Date(v.createdAt).toLocaleDateString('es-AR')}</td>
                    <td>$ {formatNumber(Number(v.amount))}</td>
                    <td>
                      <span className={styles[`estado${v.status}`]}>{ESTADO[v.status]}</span>
                      {v.status === 'RECHAZADO' && v.rejectionReason && (
                        <div className={styles.motivo}>{v.rejectionReason}</div>
                      )}
                    </td>
                    <td>
                      <button className={styles.linkBtn} onClick={() => verComprobante(v.id)}>
                        Ver comprobante
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={styles.instructionsSection}>
        <h2 className={styles.sectionTitle}>Cómo cargar créditos</h2>
        <div className={styles.instructionCards}>
          {instrucciones.map((inst, i) => (
            <div className={styles.card} key={i}>
              <div className={styles.cardIcon}>
                <CardIcon />
              </div>
              <h4>{inst.titulo}</h4>
              <p>{inst.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.reintegroLink}>
        <Link to="/reintegro">Solicitar reintegro</Link>
      </div>
    </div>
  );
}

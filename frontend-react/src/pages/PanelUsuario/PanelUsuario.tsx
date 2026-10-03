import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import styles from './PanelUsuario.module.scss';

interface Compra {
  id: number;
  referencia: string;
  fecha: string;
  descripcion: string;
  valorUnitario: number;
  valorTotal: number;
}

// Forma que devuelve GET /api/compras/mias
interface PurchaseApi {
  id: string;
  reference: string;
  totalAmount: string;
  createdAt: string;
  lot: { number: number; title: string; auction: { title: string } };
}

const formatFecha = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
};

const aCompra = (p: PurchaseApi): Compra => ({
  id: p.lot.number,
  referencia: p.reference,
  fecha: formatFecha(p.createdAt),
  descripcion: `${p.lot.title} (${p.lot.auction.title})`,
  // Un lote = una unidad: precio unitario y total coinciden
  valorUnitario: Number(p.totalAmount),
  valorTotal: Number(p.totalAmount),
});

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

// Forma que devuelve GET /api/compras/ofertas
interface Oferta {
  lotId: string;
  lotNumber: number;
  lotTitle: string;
  auctionId: string;
  auctionTitle: string;
  auctionStatus: 'PROXIMA' | 'ACTIVA';
  currentPrice: number;
  myBestBid: number;
  winning: boolean;
}

const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

export default function PanelUsuario() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [misCompras, setMisCompras] = useState<Compra[]>([]);
  const [misOfertas, setMisOfertas] = useState<Oferta[]>([]);
  const location = useLocation();
  // TODO: el backend todavía no guarda avatar; queda local a este navegador
  const [avatarUrl] = useState<string | null>(() => localStorage.getItem('userAvatar'));

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ purchases: PurchaseApi[] }>('/compras/mias')
      .then(({ purchases }) => setMisCompras(purchases.map(aCompra)))
      .catch(() => setMisCompras([]));
    api
      .get<{ offers: Oferta[] }>('/compras/ofertas')
      .then(({ offers }) => setMisOfertas(offers))
      .catch(() => setMisOfertas([]));
  }, [user]);

  // Link "Mis compras / ofertas" del menú de usuario (/perfil#compras)
  useEffect(() => {
    if (location.hash === '#compras') {
      document.getElementById('compras')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, misCompras, misOfertas]);

  const userName = user ? `${user.firstName} ${user.lastName}`.trim() || 'Usuario' : 'Usuario';
  const userPhone = user?.phone ?? '';
  const userDni = user?.dni ?? '';
  const userAddress = user?.address ?? '';
  const userCity = user?.city ?? '';
  const creditoDisponible = user?.availableCredit ?? 0;
  const creditoReservado = user?.heldCredit ?? 0;

  return (
    <div className={styles.perfilWrapper}>
      <div className={styles.userHeader}>
        <div className={styles.userInfoContainer}>
          <div className={styles.userAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className={styles.avatarImage} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#ccc">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>

          <div className={styles.userDetails}>
            <h1 className={styles.userName}>{userName}</h1>
            <p className={styles.userPhone}>Teléfono: {userPhone || 'Sin cargar'}</p>
          </div>

          <div className={styles.userExtra}>
            <div className={styles.extraColumn}>
              <p className={styles.extraTitle}>Datos de facturación</p>
              {userDni && <p className={styles.extraData}>DNI: {userDni}</p>}
              {userAddress && <p className={styles.extraData}>{userAddress}</p>}
              {userCity && <p className={styles.extraData}>{userCity}</p>}
              {!userDni && !userAddress && <p className={styles.extraData}>Sin datos cargados</p>}
            </div>

            <div className={styles.extraActions}>
              <Link to="/datos" className={styles.editProfileLink}>Editar perfil</Link>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.creditBanner}>
        <h2 className={styles.creditTitle}>Crédito disponible</h2>
        <div className={styles.creditAmount}>$ {formatNumber(creditoDisponible)}</div>
        {creditoReservado > 0 && (
          <p className={styles.creditHeld}>$ {formatNumber(creditoReservado)} reservados (lotes que vas ganando y reintegros en trámite)</p>
        )}
        <Link to="/creditos" className={styles.btnCargarCredito}>Cargar créditos</Link>
      </div>

      <div className={styles.purchasesSection} id="compras">
        {misOfertas.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>Mis ofertas en curso</h3>
            <div className={`${styles.tableResponsive} ${styles.ofertasTable}`}>
              <table className={styles.purchasesTable}>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Subasta</th>
                    <th>Mi oferta</th>
                    <th>Precio actual</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {misOfertas.map((o) => (
                    <tr key={o.lotId}>
                      <td>{o.lotNumber}. {o.lotTitle}</td>
                      <td>
                        {o.auctionStatus === 'ACTIVA' ? (
                          <Link to={`/subastas/${o.auctionId}/activa`}>{o.auctionTitle}</Link>
                        ) : (
                          o.auctionTitle
                        )}
                      </td>
                      <td>{formatCurrency(o.myBestBid)}</td>
                      <td>{formatCurrency(o.currentPrice)}</td>
                      <td><strong>{o.winning ? 'Vas ganando' : 'Te superaron'}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h3 className={styles.sectionTitle}>Mis Compras</h3>

        <div className={styles.tableResponsive}>
          <table className={styles.purchasesTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Referencia</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Valor unitario</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {misCompras.map((compra, i) => (
                <tr key={i}>
                  <td>{compra.id}</td>
                  <td>{compra.referencia}</td>
                  <td>{compra.fecha}</td>
                  <td>{compra.descripcion}</td>
                  <td>{formatCurrency(compra.valorUnitario)}</td>
                  <td><strong>{formatCurrency(compra.valorTotal)}</strong></td>
                </tr>
              ))}
              {misCompras.length === 0 && (
                <tr>
                  <td colSpan={6}>Todavía no tenés compras.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

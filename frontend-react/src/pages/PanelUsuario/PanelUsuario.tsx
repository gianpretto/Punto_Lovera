import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SeccionVender from '../../components/secciones/SeccionVender';
import Boton from '../../components/ui/Boton';
import Etiqueta from '../../components/ui/Etiqueta';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import styles from './PanelUsuario.module.scss';

// /perfil — panel del usuario (wireframes 620:13052 escritorio y 620:15223
// celular; sin diseño final). En la línea del rediseño: cabecera sobre fondo
// claro con patrón (avatar, nombre en serif, datos de facturación), banda
// verde con el crédito disponible, tablas de ofertas y compras (#compras) y
// abajo la banda de SeccionVender.

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

  const nombre = user?.firstName?.trim() ?? '';
  const apellido = user?.lastName?.trim() ?? '';
  const userPhone = user?.phone ?? '';
  const userDni = user?.dni ?? '';
  const userAddress = user?.address ?? '';
  const userCity = user?.city ?? '';
  const creditoDisponible = user?.availableCredit ?? 0;
  const creditoReservado = user?.heldCredit ?? 0;

  return (
    <>
      <div className={styles.pagina}>
        <section className={`${styles.contenedor} ${styles.cabecera}`}>
          <div className={styles.avatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={styles.avatarImagen} />
            ) : (
              <svg width="72" height="72" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>

          <div className={styles.identidad}>
            <Etiqueta tono="verde">Mi cuenta</Etiqueta>
            <h1 className={styles.nombre}>
              {nombre || apellido ? (
                <>
                  {nombre} {apellido && <em>{apellido}</em>}
                </>
              ) : (
                'Usuario'
              )}
            </h1>
            <p className={styles.telefono}>Teléfono: {userPhone || 'Sin cargar'}</p>
          </div>

          <div className={styles.facturacion}>
            <p className={styles.facturacionTitulo}>Datos de facturación</p>
            {userDni && <p>DNI: {userDni}</p>}
            {userAddress && <p>{userAddress}</p>}
            {userCity && <p>{userCity}</p>}
            {!userDni && !userAddress && <p>Sin datos cargados</p>}
          </div>

          <Link to="/datos" className={styles.editar}>
            Editar perfil <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section className={styles.contenedor} aria-labelledby="credito-titulo">
          <div className={styles.credito}>
            <div>
              <h2 id="credito-titulo" className={styles.creditoTitulo}>
                <span className={styles.creditoLinea} aria-hidden="true" />
                Crédito disponible
              </h2>
              <p className={styles.creditoMonto}>$ {formatNumber(creditoDisponible)}</p>
            </div>
            <div className={styles.creditoAcciones}>
              {creditoReservado > 0 && (
                <p className={styles.creditoReservado}>
                  <strong>$ {formatNumber(creditoReservado)}</strong> reservados (lotes que vas ganando y reintegros en
                  trámite)
                </p>
              )}
              <Boton to="/creditos" variante="claro" flecha>
                Cargar créditos
              </Boton>
            </div>
          </div>
        </section>

        <section className={`${styles.contenedor} ${styles.compras}`} id="compras">
          {misOfertas.length > 0 && (
            <div className={styles.bloque}>
              <h2 className={styles.tituloSeccion}>
                Mis ofertas <em>en curso</em>
              </h2>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th scope="col">Lote</th>
                    <th scope="col">Subasta</th>
                    <th scope="col" className={styles.numero}>Mi oferta</th>
                    <th scope="col" className={styles.numero}>Precio actual</th>
                    <th scope="col" className={styles.numero}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {misOfertas.map((o) => (
                    <tr key={o.lotId}>
                      <td data-etiqueta="Lote">
                        {o.lotNumber}. {o.lotTitle}
                      </td>
                      <td data-etiqueta="Subasta">
                        {o.auctionStatus === 'ACTIVA' ? (
                          <Link to={`/subastas/${o.auctionId}/activa`} className={styles.enlace}>
                            {o.auctionTitle}
                          </Link>
                        ) : (
                          o.auctionTitle
                        )}
                      </td>
                      <td data-etiqueta="Mi oferta" className={styles.numero}>
                        {formatCurrency(o.myBestBid)}
                      </td>
                      <td data-etiqueta="Precio actual" className={styles.numero}>
                        {formatCurrency(o.currentPrice)}
                      </td>
                      <td data-etiqueta="Estado" className={styles.numero}>
                        <span className={`${styles.estado} ${o.winning ? styles.ganando : styles.superado}`}>
                          {o.winning ? 'Vas ganando' : 'Te superaron'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.bloque}>
            <h2 className={styles.tituloSeccion}>
              Mis <em>compras</em>
            </h2>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Referencia</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Descripción</th>
                  <th scope="col" className={styles.numero}>Valor unitario</th>
                  <th scope="col" className={styles.numero}>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {misCompras.map((compra, i) => (
                  <tr key={i}>
                    <td data-etiqueta="#">{compra.id}</td>
                    <td data-etiqueta="Referencia">{compra.referencia}</td>
                    <td data-etiqueta="Fecha">{compra.fecha}</td>
                    <td data-etiqueta="Descripción">{compra.descripcion}</td>
                    <td data-etiqueta="Valor unitario" className={styles.numero}>
                      {formatCurrency(compra.valorUnitario)}
                    </td>
                    <td data-etiqueta="Valor total" className={`${styles.numero} ${styles.total}`}>
                      {formatCurrency(compra.valorTotal)}
                    </td>
                  </tr>
                ))}
                {misCompras.length === 0 && (
                  <tr className={styles.vacio}>
                    <td colSpan={6}>Todavía no tenés compras.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <SeccionVender origen="perfil" />
    </>
  );
}

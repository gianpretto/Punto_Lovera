import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import type { AuctionStatus } from '../../services/auctions';
import panel from '../PanelMartillero/PanelMartillero.module.scss';
import styles from './AdminSubastas.module.scss';

// Lista de todas las subastas para el martillero/admin (pantalla interna,
// sin diseño de la diseñadora): crear una nueva, editarla con sus lotes, o
// ir al panel del martillero / la sala.

interface AuctionListItem {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  status: AuctionStatus;
  lots: { id: string }[];
}

const ESTADOS_SUBASTA: Record<AuctionStatus, string> = {
  PROXIMA: 'Próxima',
  ACTIVA: 'Activa (en vivo)',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

export default function AdminSubastas() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const esMartillero = user?.role === 'MARTILLERO' || user?.role === 'ADMIN';

  const [auctions, setAuctions] = useState<AuctionListItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !esMartillero) navigate(user ? '/' : '/login');
  }, [loading, esMartillero, user, navigate]);

  useEffect(() => {
    if (!esMartillero) return;
    api
      .get<{ auctions: AuctionListItem[] }>('/subastas')
      // Las más nuevas (o más lejanas en el tiempo) primero
      .then(({ auctions }) => setAuctions([...auctions].sort((a, b) => b.startsAt.localeCompare(a.startsAt))))
      .catch((err) => {
        setAuctions([]);
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las subastas');
      });
  }, [esMartillero]);

  if (!esMartillero) return null;

  return (
    <div className={panel.panel}>
      <div className={panel.header}>
        <div>
          <h1>ADMINISTRAR SUBASTAS</h1>
          <p className={panel.subtitle}>Cargá los remates, sus lotes y fotos.</p>
        </div>
        <Link to="/admin/subastas/nueva" className={panel.btnNegro}>
          Nueva subasta
        </Link>
      </div>

      {error && <div className={panel.alertDanger}>{error}</div>}

      <section className={panel.card}>
        {auctions === null ? (
          <p className={panel.vacio}>Cargando...</p>
        ) : auctions.length === 0 ? (
          <p className={panel.vacio}>Todavía no hay subastas cargadas.</p>
        ) : (
          <div className={panel.tableResponsive}>
            <table className={panel.table}>
              <thead>
                <tr>
                  <th>Subasta</th>
                  <th>Fecha y hora</th>
                  <th>Estado</th>
                  <th>Lotes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {auctions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.title}
                      <div className={panel.hora}>{a.location}</div>
                    </td>
                    <td>{fechaHora(a.startsAt)}</td>
                    <td>
                      <span className={`${styles.estado} ${styles[`estado${a.status}`] ?? ''}`}>
                        {ESTADOS_SUBASTA[a.status]}
                      </span>
                    </td>
                    <td>{a.lots.length}</td>
                    <td>
                      <div className={panel.acciones}>
                        <Link className={panel.btnChico} to={`/admin/subastas/${a.id}`}>
                          Editar
                        </Link>
                        <Link className={panel.btnChico} to={`/subastas/${a.id}/martillero`}>
                          Panel del martillero
                        </Link>
                        <Link className={`${panel.btnGris} ${styles.chico}`} to={`/subastas/${a.id}/activa`}>
                          Sala
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

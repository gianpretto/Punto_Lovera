import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import styles from '../PanelMartillero/PanelMartillero.module.scss';
import propios from './AdminConsultas.module.scss';

// Pantalla interna: consultas que llegan por los formularios "¿Tenés bienes
// para vender?" y Contactanos. Se guardan siempre en la base (aunque el mail
// de aviso falle o no haya SMTP), así que acá no se pierde ninguna.
// Se responden por mail desde la casilla de cada uno ("Responder").

interface Consulta {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  source: string | null;
  createdAt: string;
}

// De qué página vino la consulta (el `source` que manda cada formulario)
const ORIGENES: Record<string, string> = {
  home: 'Inicio',
  contactanos: 'Contactanos',
  'quiero-vender': 'Quiero vender',
  'quienes-somos': 'Quiénes somos',
};

export default function AdminConsultas() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const esAdmin = user?.role === 'ADMIN';

  const [consultas, setConsultas] = useState<Consulta[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !esAdmin) navigate(user ? '/' : '/login');
  }, [loading, esAdmin, user, navigate]);

  useEffect(() => {
    if (!esAdmin) return;
    api
      .get<{ messages: Consulta[] }>('/contacto')
      .then(({ messages }) => setConsultas(messages))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las consultas'));
  }, [esAdmin]);

  if (!esAdmin) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h1>CONSULTAS RECIBIDAS</h1>
          <p className={styles.subtitle}>
            Lo que mandan desde "¿Tenés bienes para vender?" y Contactanos, de la más nueva a la más vieja.
          </p>
        </div>
      </div>

      {error && <div className={styles.alertDanger}>{error}</div>}

      <section className={styles.card}>
        {consultas === null ? (
          <p className={styles.vacio}>Cargando...</p>
        ) : consultas.length === 0 ? (
          <p className={styles.vacio}>Todavía no llegó ninguna consulta.</p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>De</th>
                  <th>Mensaje</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {consultas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {new Date(c.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                      {c.source && <div className={styles.hora}>{ORIGENES[c.source] ?? c.source}</div>}
                    </td>
                    <td>
                      {c.name}
                      <div className={styles.hora}>{c.email}</div>
                      {c.phone && <div className={styles.hora}>Tel. {c.phone}</div>}
                    </td>
                    <td className={propios.mensaje}>{c.message}</td>
                    <td>
                      <a
                        className={styles.btnChico}
                        href={`mailto:${c.email}?subject=${encodeURIComponent('Tu consulta en Punto Lovera')}`}
                      >
                        Responder
                      </a>
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

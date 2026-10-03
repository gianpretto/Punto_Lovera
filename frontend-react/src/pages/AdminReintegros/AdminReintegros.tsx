import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import styles from '../PanelMartillero/PanelMartillero.module.scss';

// Pantalla interna (sin diseño de la diseñadora): el admin ve los pedidos de
// reintegro, transfiere por fuera de la plataforma (home banking) y después
// lo aprueba acá, que es cuando se descuenta del saldo del usuario. Mientras
// está pendiente el monto ya está reservado (no lo puede usar para pujar).
// Misma estructura que AdminComprobantes.

interface PendingWithdrawal {
  id: string;
  amount: string;
  cbu: string;
  alias: string | null;
  reason: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string; dni: string | null };
}

const pesos = (n: number | string) => `$${Number(n).toLocaleString('es-AR')}`;

export default function AdminReintegros() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const esAdmin = user?.role === 'ADMIN';

  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[] | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !esAdmin) navigate(user ? '/' : '/login');
  }, [loading, esAdmin, user, navigate]);

  const cargar = useCallback(async () => {
    try {
      const { withdrawals } = await api.get<{ withdrawals: PendingWithdrawal[] }>('/creditos/reintegros/pendientes');
      setWithdrawals(withdrawals);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los reintegros');
    }
  }, []);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, cargar]);

  const revisar = async (w: PendingWithdrawal, aprobar: boolean) => {
    const quien = `${w.user.firstName} ${w.user.lastName}`;
    let reason = '';
    if (aprobar) {
      if (
        !window.confirm(
          `¿Confirmás que ya le transferiste ${pesos(w.amount)} a ${quien} (CBU ${w.cbu})? Se descuenta de su crédito.`
        )
      )
        return;
    } else {
      reason = window.prompt(`¿Por qué se rechaza el reintegro de ${quien}? (le llega por mail)`)?.trim() ?? '';
      if (!reason) return;
    }
    setBusy(w.id);
    setError('');
    setAviso('');
    try {
      if (aprobar) await api.post(`/creditos/reintegros/${w.id}/aprobar`);
      else await api.post(`/creditos/reintegros/${w.id}/rechazar`, { reason });
      setAviso(
        aprobar
          ? `Reintegro de ${pesos(w.amount)} a ${quien} aprobado y descontado de su crédito.`
          : `Reintegro de ${quien} rechazado: el monto vuelve a estar disponible en su crédito.`
      );
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo revisar el reintegro');
    } finally {
      setBusy(null);
    }
  };

  const copiar = (texto: string) =>
    navigator.clipboard?.writeText(texto).then(
      () => setAviso(`Copiado: ${texto}`),
      () => setError('No se pudo copiar')
    );

  if (!esAdmin) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h1>REINTEGROS A PAGAR</h1>
          <p className={styles.subtitle}>
            Transferí desde el banco a la cuenta indicada y después aprobá el pedido (se descuenta del crédito del usuario).
          </p>
        </div>
      </div>

      {error && <div className={styles.alertDanger}>{error}</div>}
      {aviso && <div className={styles.alertSuccess}>{aviso}</div>}

      <section className={styles.card}>
        {withdrawals === null ? (
          <p className={styles.vacio}>Cargando...</p>
        ) : withdrawals.length === 0 ? (
          <p className={styles.vacio}>No hay reintegros pendientes.</p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Monto</th>
                  <th>Transferir a</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td>{new Date(w.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      {w.user.firstName} {w.user.lastName}
                      <div className={styles.hora}>{w.user.email}</div>
                      {w.user.dni && <div className={styles.hora}>DNI {w.user.dni}</div>}
                    </td>
                    <td>{pesos(w.amount)}</td>
                    <td>
                      <div>
                        CBU: {w.cbu}{' '}
                        <button className={styles.btnChico} onClick={() => copiar(w.cbu)}>
                          Copiar
                        </button>
                      </div>
                      {w.alias && (
                        <div className={styles.hora}>
                          Alias: {w.alias}
                        </div>
                      )}
                      {w.reason && <div className={styles.hora}>Motivo: {w.reason}</div>}
                    </td>
                    <td>
                      <div className={styles.acciones}>
                        <button className={styles.btnChico} onClick={() => revisar(w, true)} disabled={busy === w.id}>
                          Aprobar
                        </button>
                        <button className={styles.btnGris} onClick={() => revisar(w, false)} disabled={busy === w.id}>
                          Rechazar
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
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError, openProtectedFile } from '../../services/api';
import styles from '../PanelMartillero/PanelMartillero.module.scss';

// Pantalla interna (sin diseño de la diseñadora): el admin revisa los
// comprobantes de transferencia y acredita el saldo. Reusa los estilos del
// panel del martillero.

interface PendingVoucher {
  id: string;
  amount: string;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
}

const pesos = (n: number | string) => `$${Number(n).toLocaleString('es-AR')}`;

export default function AdminComprobantes() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const esAdmin = user?.role === 'ADMIN';

  const [vouchers, setVouchers] = useState<PendingVoucher[] | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !esAdmin) navigate(user ? '/' : '/login');
  }, [loading, esAdmin, user, navigate]);

  const cargar = useCallback(async () => {
    try {
      const { vouchers } = await api.get<{ vouchers: PendingVoucher[] }>('/creditos/pendientes');
      setVouchers(vouchers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los comprobantes');
    }
  }, []);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, cargar]);

  const revisar = async (v: PendingVoucher, aprobar: boolean) => {
    const quien = `${v.user.firstName} ${v.user.lastName}`;
    let reason = '';
    if (aprobar) {
      if (!window.confirm(`¿Confirmás que recibiste ${pesos(v.amount)} de ${quien}? Se acredita en su cuenta.`)) return;
    } else {
      reason = window.prompt(`¿Por qué se rechaza el comprobante de ${quien}? (le llega por mail)`)?.trim() ?? '';
      if (!reason) return;
    }
    setBusy(v.id);
    setError('');
    setAviso('');
    try {
      if (aprobar) await api.post(`/creditos/${v.id}/aprobar`);
      else await api.post(`/creditos/${v.id}/rechazar`, { reason });
      setAviso(aprobar ? `Se acreditaron ${pesos(v.amount)} a ${quien}.` : `Comprobante de ${quien} rechazado.`);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo revisar el comprobante');
    } finally {
      setBusy(null);
    }
  };

  const ver = (id: string) =>
    openProtectedFile(`/creditos/${id}/archivo`).catch((err) =>
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el comprobante')
    );

  if (!esAdmin) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h1>COMPROBANTES PENDIENTES</h1>
          <p className={styles.subtitle}>Revisá cada transferencia antes de acreditar el saldo.</p>
        </div>
      </div>

      {error && <div className={styles.alertDanger}>{error}</div>}
      {aviso && <div className={styles.alertSuccess}>{aviso}</div>}

      <section className={styles.card}>
        {vouchers === null ? (
          <p className={styles.vacio}>Cargando...</p>
        ) : vouchers.length === 0 ? (
          <p className={styles.vacio}>No hay comprobantes pendientes.</p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td>{new Date(v.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      {v.user.firstName} {v.user.lastName}
                      <div className={styles.hora}>{v.user.email}</div>
                    </td>
                    <td>{pesos(v.amount)}</td>
                    <td>
                      <div className={styles.acciones}>
                        <button className={styles.btnChico} onClick={() => ver(v.id)}>
                          Ver comprobante
                        </button>
                        <button className={styles.btnChico} onClick={() => revisar(v, true)} disabled={busy === v.id}>
                          Aprobar
                        </button>
                        <button className={styles.btnGris} onClick={() => revisar(v, false)} disabled={busy === v.id}>
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

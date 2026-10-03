import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api, ApiError } from '../../services/api';
import styles from './Reintegro.module.scss';

// Pedido de reintegro: el usuario pide que le devuelvan crédito que no usó.
// El monto queda reservado hasta que un admin transfiere y lo aprueba (se
// descuenta del saldo) o lo rechaza (se libera).

const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default function Reintegro() {
  const navigate = useNavigate();
  const { user, loading, refreshUser } = useAuth();
  // Lo que puede pedir: saldo - reservas (lotes que va ganando y reintegros pendientes)
  const disponible = user?.availableCredit ?? 0;

  const [monto, setMonto] = useState('');
  const [cbu, setCbu] = useState('');
  const [alias, setAlias] = useState('');
  const [motivo, setMotivo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  const montoNumero = Number(monto);
  const cbuDigitos = cbu.replace(/[\s-]/g, '');
  const errors = {
    monto: monto === '' || !(montoNumero > 0) || montoNumero > disponible,
    cbu: !/^\d{22}$/.test(cbuDigitos),
    alias: alias.trim() === '',
  };
  const formInvalid = errors.monto || errors.cbu || errors.alias;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (formInvalid || sending) return;

    setSending(true);
    setError('');
    try {
      await api.post('/creditos/reintegros', {
        amount: montoNumero,
        cbu: cbuDigitos,
        alias: alias.trim(),
        reason: motivo.trim() || undefined,
      });
      // El disponible baja: el monto queda reservado mientras se procesa
      await refreshUser();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el pedido de reintegro.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => navigate('/creditos'), 3000);
    return () => clearTimeout(t);
  }, [success, navigate]);

  if (!user) return null;

  return (
    <div className={styles.reintegroWrapper}>
      {!success && (
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Solicitar Reintegro</h1>
          <p className={styles.subtitle}>
            Completá los datos de la cuenta donde querés recibir el dinero de vuelta.
          </p>
          <p className={styles.disponible}>
            Podés pedir hasta <strong>$ {formatNumber(Math.max(disponible, 0))}</strong> (tu crédito disponible).
          </p>

          <form className={styles.reintegroForm} onSubmit={onSubmit} noValidate>
            <div className={styles.formGroup}>
              <label>Monto a reintegrar</label>
              <input
                type="number"
                min={1}
                className={`${styles.formControl} ${submitted && errors.monto ? styles.isInvalid : ''}`}
                placeholder="$ 0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              {submitted && monto !== '' && montoNumero > disponible && (
                <span className={styles.fieldError}>Supera tu crédito disponible.</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>CBU (22 dígitos)</label>
              <input
                type="text"
                inputMode="numeric"
                className={`${styles.formControl} ${submitted && errors.cbu ? styles.isInvalid : ''}`}
                placeholder="0000000000000000000000"
                value={cbu}
                onChange={(e) => setCbu(e.target.value)}
              />
              {submitted && errors.cbu && cbu.trim() !== '' && (
                <span className={styles.fieldError}>El CBU tiene que tener 22 dígitos.</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Alias</label>
              <input
                type="text"
                className={`${styles.formControl} ${submitted && errors.alias ? styles.isInvalid : ''}`}
                placeholder="mi.alias.pago"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Motivo (opcional)</label>
              <textarea
                className={`${styles.formControl} ${styles.textarea}`}
                placeholder="¿Por qué solicitas el reintegro?"
                value={motivo}
                maxLength={500}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            {error && <div className={styles.alertDanger}>{error}</div>}

            <button type="submit" className={styles.btnBlack} disabled={sending || disponible <= 0}>
              {sending ? 'Enviando...' : 'Solicitar Reintegro'}
            </button>
            <Link to="/creditos" className={styles.btnBack}>Cancelar</Link>
          </form>
        </div>
      )}

      {success && (
        <div className={styles.successMessage}>
          <div className={styles.iconCircle}>
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 className={styles.successTitle}>Solicitud enviada</h2>
          <p className={styles.successDesc}>
            Recibimos tu pedido de reintegro. El monto queda reservado hasta que te lo transfiramos; te avisamos por mail.
            Serás redirigido a tus créditos en un momento.
          </p>
        </div>
      )}
    </div>
  );
}

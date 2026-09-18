import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Reintegro.module.scss';

export default function Reintegro() {
  const navigate = useNavigate();

  const [monto, setMonto] = useState('');
  const [cbu, setCbu] = useState('');
  const [alias, setAlias] = useState('');
  const [motivo, setMotivo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);

  const errors = {
    monto: monto === '' || Number(monto) < 1,
    cbu: cbu.trim() === '' || cbu.trim().length !== 22,
    alias: alias.trim() === '',
  };
  const formInvalid = errors.monto || errors.cbu || errors.alias;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (formInvalid) return;

    // Simular el pedido
    setSuccess(true);
  };

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => navigate('/perfil'), 3000);
    return () => clearTimeout(t);
  }, [success, navigate]);

  return (
    <div className={styles.reintegroWrapper}>
      {!success && (
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Solicitar Reintegro</h1>
          <p className={styles.subtitle}>
            Completá los datos de la cuenta donde querés recibir el dinero de vuelta.
          </p>

          <form className={styles.reintegroForm} onSubmit={onSubmit} noValidate>
            <div className={styles.formGroup}>
              <label>Monto a reintegrar</label>
              <input
                type="number"
                className={`${styles.formControl} ${submitted && errors.monto ? styles.isInvalid : ''}`}
                placeholder="$ 0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>CBU (22 dígitos)</label>
              <input
                type="text"
                className={`${styles.formControl} ${submitted && errors.cbu ? styles.isInvalid : ''}`}
                placeholder="0000000000000000000000"
                value={cbu}
                onChange={(e) => setCbu(e.target.value)}
              />
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
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <button type="submit" className={styles.btnBlack}>Solicitar Reintegro</button>
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
            Tu solicitud de reintegro ha sido recibida y está siendo procesada. Serás redirigido a tu perfil en un
            momento.
          </p>
        </div>
      )}
    </div>
  );
}

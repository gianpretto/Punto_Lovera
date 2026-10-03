import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../services/api';
import styles from './ForgotPassword.module.scss';

function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Dos usos:
//  - /forgot-password            → pide el mail y el backend manda el link
//  - /forgot-password?token=...  → link del mail: elegir contraseña nueva
export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  return token ? <NuevaPassword token={token} /> : <PedirLink />;
}

function PedirLink() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const errors = {
    required: email.trim() === '',
    email: email.trim() !== '' && !validarEmail(email),
  };
  const formInvalid = errors.required || errors.email;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMessage('');

    if (formInvalid || sending) return;

    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccessMessage('Si el correo existe, recibirás un enlace para restablecer tu contraseña.');
      setEmail('');
      setSubmitted(false);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudo enviar el correo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.forgotWrapper}>
      <div className={styles.forgotContent}>
        <h1 className={styles.forgotTitle}>RECUPERAR CONTRASEÑA</h1>
        <p className={styles.forgotDesc}>
          Ingresá tu correo electrónico y te enviaremos las instrucciones para restablecer tu contraseña.
        </p>

        <form className={styles.forgotForm} onSubmit={onSubmit} noValidate>
          <div className={styles.formGroup}>
            <input
              type="email"
              className={`${styles.formControl} ${submitted && formInvalid ? styles.isInvalid : ''}`}
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {submitted && errors.required && (
              <div className={styles.invalidFeedback}>El correo es obligatorio</div>
            )}
            {submitted && !errors.required && errors.email && (
              <div className={styles.invalidFeedback}>Ingrese un correo válido</div>
            )}
          </div>

          {successMessage && <div className={styles.alertSuccess}>{successMessage}</div>}
          {errorMessage && <div className={styles.alertDanger}>{errorMessage}</div>}

          <div className={styles.formActions}>
            <button type="submit" className={`${styles.btn} ${styles.btnBlack}`} disabled={sending}>
              Enviar instrucciones
            </button>
            <Link to="/login" className={`${styles.btn} ${styles.btnLink}`}>Volver al inicio de sesión</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// Pantalla nueva (no existe en el diseño Angular): reutiliza los mismos
// estilos que el formulario de recuperar para no inventar diseño.
function NuevaPassword({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const errors = {
    minlength: password.length < 8,
    mismatch: confirmPassword !== password,
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMessage('');

    if (errors.minlength || errors.mismatch || sending) return;

    setSending(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.forgotWrapper}>
      <div className={styles.forgotContent}>
        <h1 className={styles.forgotTitle}>NUEVA CONTRASEÑA</h1>

        {done ? (
          <>
            <div className={styles.alertSuccess}>Contraseña actualizada. Ya podés iniciar sesión.</div>
            <div className={styles.formActions}>
              <Link to="/login" className={`${styles.btn} ${styles.btnBlack}`}>Iniciar sesión</Link>
            </div>
          </>
        ) : (
          <form className={styles.forgotForm} onSubmit={onSubmit} noValidate>
            <div className={styles.formGroup}>
              <input
                type="password"
                className={`${styles.formControl} ${submitted && errors.minlength ? styles.isInvalid : ''}`}
                placeholder="Contraseña nueva"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {submitted && errors.minlength && <div className={styles.invalidFeedback}>Mínimo 8 caracteres</div>}
            </div>

            <div className={styles.formGroup}>
              <input
                type="password"
                className={`${styles.formControl} ${submitted && errors.mismatch ? styles.isInvalid : ''}`}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {submitted && errors.mismatch && (
                <div className={styles.invalidFeedback}>Las contraseñas no coinciden</div>
              )}
            </div>

            {errorMessage && <div className={styles.alertDanger}>{errorMessage}</div>}

            <div className={styles.formActions}>
              <button type="submit" className={`${styles.btn} ${styles.btnBlack}`} disabled={sending}>
                Guardar contraseña
              </button>
              <Link to="/login" className={`${styles.btn} ${styles.btnLink}`}>Volver al inicio de sesión</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

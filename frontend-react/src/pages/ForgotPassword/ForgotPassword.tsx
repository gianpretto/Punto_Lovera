import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import styles from './ForgotPassword.module.scss';

function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const errors = {
    required: email.trim() === '',
    email: email.trim() !== '' && !validarEmail(email),
  };
  const formInvalid = errors.required || errors.email;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (formInvalid) return;

    // Mock: en el backend real esto dispara el envío de mail
    console.log('Recover password for:', email);
    setSuccessMessage('Si el correo existe, recibirás un enlace para restablecer tu contraseña.');
    setEmail('');
    setSubmitted(false);
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

          <div className={styles.formActions}>
            <button type="submit" className={`${styles.btn} ${styles.btnBlack}`}>Enviar instrucciones</button>
            <Link to="/login" className={`${styles.btn} ${styles.btnLink}`}>Volver al inicio de sesión</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

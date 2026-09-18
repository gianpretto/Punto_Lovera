import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import styles from './Login.module.scss';

function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loginError, setLoginError] = useState('');

  const emailErrors = {
    required: email.trim() === '',
    email: email.trim() !== '' && !validarEmail(email),
  };
  const passwordErrors = {
    required: password === '',
    minlength: password !== '' && password.length < 6,
  };
  const formInvalid =
    emailErrors.required || emailErrors.email || passwordErrors.required || passwordErrors.minlength;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setLoginError('');

    if (formInvalid) return;

    if (login(email, password)) {
      navigate('/');
    } else {
      setLoginError('Credenciales inválidas o usuario no registrado.');
    }
  };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginImage}>
        <div className={styles.imagePlaceholder}>
          <img src="/assets/img/default.png" alt="Login Image" />
        </div>
      </div>

      <div className={styles.loginContent}>
        <h1 className={styles.loginTitle}>INICIAR SESIÓN</h1>

        <form className={styles.loginForm} onSubmit={onSubmit} noValidate>
          {loginError && <div className={styles.alertDanger}>{loginError}</div>}

          <div className={styles.formGroup}>
            <input
              type="email"
              className={`${styles.formControl} ${submitted && (emailErrors.required || emailErrors.email) ? styles.isInvalid : ''}`}
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {submitted && emailErrors.required && (
              <div className={styles.invalidFeedback}>El correo es obligatorio</div>
            )}
            {submitted && !emailErrors.required && emailErrors.email && (
              <div className={styles.invalidFeedback}>Ingrese un correo válido</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <input
              type="password"
              className={`${styles.formControl} ${submitted && (passwordErrors.required || passwordErrors.minlength) ? styles.isInvalid : ''}`}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {submitted && passwordErrors.required && (
              <div className={styles.invalidFeedback}>La contraseña es obligatoria</div>
            )}
            {submitted && !passwordErrors.required && passwordErrors.minlength && (
              <div className={styles.invalidFeedback}>Mínimo 6 caracteres</div>
            )}
          </div>

          <div className={styles.formCheck}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe">Recordarme</label>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={`${styles.btn} ${styles.btnBlack}`}>Iniciar Sesión</button>
            <Link to="/registro" className={`${styles.btn} ${styles.btnGray}`}>O creá una cuenta</Link>
          </div>

          <div className={styles.formFooter}>
            <Link to="/forgot-password" className={styles.forgotLink}>Olvidé la contraseña</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

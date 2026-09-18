import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import styles from './Registro.module.scss';

function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface Touched {
  nombre: boolean;
  apellido: boolean;
  email: boolean;
  password: boolean;
  confirmPassword: boolean;
}

export default function Registro() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Touched>({
    nombre: false,
    apellido: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const errors = {
    nombre: { required: nombre.trim() === '' },
    apellido: { required: apellido.trim() === '' },
    email: { required: email.trim() === '', email: email.trim() !== '' && !validarEmail(email) },
    password: { required: password === '', minlength: password !== '' && password.length < 6 },
    confirmPassword: {
      required: confirmPassword === '',
      mismatch: confirmPassword !== '' && confirmPassword !== password,
    },
  };

  const hasError = (field: keyof Touched) => Object.values(errors[field]).some(Boolean);
  const showError = (field: keyof Touched) => (submitted || touched[field]) && hasError(field);

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const formInvalid = (Object.keys(errors) as (keyof Touched)[]).some((f) => hasError(f));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (formInvalid) return;

    register(email, password, nombre, apellido);
    navigate('/validar-mail');
  };

  return (
    <div className={styles.registroWrapper}>
      <div className={styles.registroImage}>
        <div className={styles.imagePlaceholder}>
          <img src="/assets/img/default.png" alt="Registro Image" />
        </div>
      </div>

      <div className={styles.registroContent}>
        <h1 className={styles.registroTitle}>REGISTRARSE</h1>

        <form className={styles.registroForm} onSubmit={onSubmit} noValidate>
          <div className={styles.formGroup}>
            <input
              type="text"
              className={`${styles.formControl} ${showError('nombre') ? styles.isInvalid : ''}`}
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={() => markTouched('nombre')}
            />
            {showError('nombre') && errors.nombre.required && (
              <div className={styles.invalidFeedback}>El nombre es obligatorio</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <input
              type="text"
              className={`${styles.formControl} ${showError('apellido') ? styles.isInvalid : ''}`}
              placeholder="Apellido"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              onBlur={() => markTouched('apellido')}
            />
            {showError('apellido') && errors.apellido.required && (
              <div className={styles.invalidFeedback}>El apellido es obligatorio</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <input
              type="email"
              className={`${styles.formControl} ${showError('email') ? styles.isInvalid : ''}`}
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
            />
            {showError('email') && errors.email.required && (
              <div className={styles.invalidFeedback}>El correo es obligatorio</div>
            )}
            {showError('email') && !errors.email.required && errors.email.email && (
              <div className={styles.invalidFeedback}>Ingrese un correo válido</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <input
              type="password"
              className={`${styles.formControl} ${showError('password') ? styles.isInvalid : ''}`}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => markTouched('password')}
            />
            {showError('password') && errors.password.required && (
              <div className={styles.invalidFeedback}>La contraseña es obligatoria</div>
            )}
            {showError('password') && !errors.password.required && errors.password.minlength && (
              <div className={styles.invalidFeedback}>Mínimo 6 caracteres</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <input
              type="password"
              className={`${styles.formControl} ${showError('confirmPassword') ? styles.isInvalid : ''}`}
              placeholder="Repite la contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => markTouched('confirmPassword')}
            />
            {showError('confirmPassword') && errors.confirmPassword.required && (
              <div className={styles.invalidFeedback}>Debes confirmar tu contraseña</div>
            )}
            {showError('confirmPassword') && !errors.confirmPassword.required && errors.confirmPassword.mismatch && (
              <div className={styles.invalidFeedback}>Las contraseñas no coinciden</div>
            )}
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={`${styles.btn} ${styles.btnBlack}`}>Registrarse</button>
            <Link to="/login" className={`${styles.btn} ${styles.btnGray}`}>O iniciá sesión con tu cuenta</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

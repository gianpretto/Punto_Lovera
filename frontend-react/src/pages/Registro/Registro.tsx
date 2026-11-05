import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PantallaAuth from '../../components/auth/PantallaAuth';
import estilos from '../../components/auth/PantallaAuth.module.scss';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import { useAuth } from '../../services/AuthContext';
import { ApiError } from '../../services/api';
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

// Registro (wireframes "Sign in" 620:12854 / 620:15046) con el layout común
// de PantallaAuth. El wireframe solo tiene correo y contraseñas; nombre y
// apellido se mantienen porque el backend los pide al registrarse.
export default function Registro() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [searchParams] = useSearchParams();
  const volver = searchParams.get('volver');

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [registerError, setRegisterError] = useState('');
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
    password: { required: password === '', minlength: password !== '' && password.length < 8 },
    confirmPassword: {
      required: confirmPassword === '',
      mismatch: confirmPassword !== '' && confirmPassword !== password,
    },
  };

  const hasError = (field: keyof Touched) => Object.values(errors[field]).some(Boolean);
  const showError = (field: keyof Touched) => (submitted || touched[field]) && hasError(field);

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const formInvalid = (Object.keys(errors) as (keyof Touched)[]).some((f) => hasError(f));

  // Mensaje a mostrar debajo de cada campo (el primero que aplique)
  const mensajes: Record<keyof Touched, string | undefined> = {
    nombre: errors.nombre.required ? 'El nombre es obligatorio' : undefined,
    apellido: errors.apellido.required ? 'El apellido es obligatorio' : undefined,
    email: errors.email.required
      ? 'El correo es obligatorio'
      : errors.email.email
        ? 'Ingrese un correo válido'
        : undefined,
    password: errors.password.required
      ? 'La contraseña es obligatoria'
      : errors.password.minlength
        ? 'Mínimo 8 caracteres'
        : undefined,
    confirmPassword: errors.confirmPassword.required
      ? 'Debes confirmar tu contraseña'
      : errors.confirmPassword.mismatch
        ? 'Las contraseñas no coinciden'
        : undefined,
  };
  const errorDe = (field: keyof Touched) => (showError(field) ? mensajes[field] : undefined);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setRegisterError('');

    if (formInvalid || sending) return;

    setSending(true);
    try {
      await register(email, password, nombre, apellido);
      // El mail viaja a /validar-mail para poder ofrecer "Reenviar correo"
      navigate('/validar-mail', { state: { email } });
    } catch (err) {
      setRegisterError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta. Intentá de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <PantallaAuth
      etiqueta="Mi cuenta"
      titulo={<em>Registrarse</em>}
      origen="registro"
    >
      <form className={estilos.formulario} onSubmit={onSubmit} noValidate>
        {registerError && <Aviso tipo="error">{registerError}</Aviso>}

        <div className={styles.fila}>
          <Campo
            etiqueta="Nombre"
            autoComplete="given-name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => markTouched('nombre')}
            error={errorDe('nombre')}
          />
          <Campo
            etiqueta="Apellido"
            autoComplete="family-name"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            onBlur={() => markTouched('apellido')}
            error={errorDe('apellido')}
          />
        </div>

        <Campo
          etiqueta="Correo"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => markTouched('email')}
          error={errorDe('email')}
        />

        <Campo
          etiqueta="Contraseña"
          type="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => markTouched('password')}
          error={errorDe('password')}
        />

        <Campo
          etiqueta="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => markTouched('confirmPassword')}
          error={errorDe('confirmPassword')}
        />

        <div className={estilos.acciones}>
          <Boton variante="verde" type="submit" bloque disabled={sending}>
            {sending ? 'Creando cuenta...' : 'Registrarse'}
          </Boton>
          <Boton variante="claro" bloque to={volver ? `/login?volver=${encodeURIComponent(volver)}` : '/login'}>
            O iniciá sesión con tu cuenta
          </Boton>
        </div>
      </form>
    </PantallaAuth>
  );
}

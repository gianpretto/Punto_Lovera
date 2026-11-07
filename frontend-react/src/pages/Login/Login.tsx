import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PantallaAuth from '../../components/auth/PantallaAuth';
import BotonGoogle from '../../components/auth/BotonGoogle';
import estilos from '../../components/auth/PantallaAuth.module.scss';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import { useSoloSinSesion } from '../../services/useSoloSinSesion';
import { useAuth } from '../../services/AuthContext';
import { ApiError } from '../../services/api';
import { registrarEvento } from '../../services/analytics';

function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Login (wireframes "Log in" 620:12755 / 620:14958) con el layout común
// de PantallaAuth.
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  // Ya logueado: no tiene sentido mostrar esta pantalla
  useSoloSinSesion();
  const [searchParams] = useSearchParams();
  // Ej: la sala del remate manda acá con ?volver=/subastas/:id/activa
  const volver = searchParams.get('volver');
  const destino = volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [sending, setSending] = useState(false);

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

  const errorEmail = !submitted
    ? undefined
    : emailErrors.required
      ? 'El correo es obligatorio'
      : emailErrors.email
        ? 'Ingrese un correo válido'
        : undefined;
  const errorPassword = !submitted
    ? undefined
    : passwordErrors.required
      ? 'La contraseña es obligatoria'
      : passwordErrors.minlength
        ? 'Mínimo 6 caracteres'
        : undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setLoginError('');

    if (formInvalid || sending) return;

    setSending(true);
    try {
      await login(email, password, rememberMe);
      registrarEvento('login', { method: 'email' });
      navigate(destino);
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Credenciales inválidas o usuario no registrado.');
    } finally {
      setSending(false);
    }
  };

  return (
    <PantallaAuth
      etiqueta="Mi cuenta"
      titulo={
        <>
          Iniciar <em>sesión</em>
        </>
      }
      origen="login"
    >
      {/* Cuenta nueva con Google: primero que complete sus datos */}
      <BotonGoogle
        onIngreso={(u, nuevo) =>
          navigate(nuevo && !u.profileComplete ? `/datos?volver=${encodeURIComponent(destino)}` : destino)
        }
      />
      <form className={estilos.formulario} onSubmit={onSubmit} noValidate>
        {loginError && <Aviso tipo="error">{loginError}</Aviso>}

        <Campo
          etiqueta="Correo"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorEmail}
        />

        <Campo
          etiqueta="Contraseña"
          type="password"
          placeholder="Tu contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errorPassword}
        />

        <label className={estilos.recordarme}>
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          Recordarme
        </label>

        <div className={estilos.acciones}>
          <Boton variante="verde" type="submit" bloque disabled={sending}>
            {sending ? 'Ingresando...' : 'Iniciar sesión'}
          </Boton>
          <Boton variante="claro" bloque to={volver ? `/registro?volver=${encodeURIComponent(volver)}` : '/registro'}>
            O creá una cuenta
          </Boton>
        </div>

        <Link to="/forgot-password" className={estilos.enlace}>
          Olvidé la contraseña
        </Link>
      </form>
    </PantallaAuth>
  );
}

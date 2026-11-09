import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PantallaAuth from '../../components/auth/PantallaAuth';
import BotonGoogle from '../../components/auth/BotonGoogle';
import estilos from '../../components/auth/PantallaAuth.module.scss';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import { useSoloSinSesion } from '../../services/useSoloSinSesion';
import { useAuth } from '../../services/AuthContext';
import { ApiError } from '../../services/api';
import styles from './Registro.module.scss';
import { registrarEvento } from '../../services/analytics';
import * as v from '../../services/validaciones';
import { destinoSeguro } from '../../services/destinoSeguro';

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
  const { register, login } = useAuth();
  // Ya logueado: no tiene sentido mostrar esta pantalla
  useSoloSinSesion();
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

  // Mensaje a mostrar debajo de cada campo (mismas reglas que el backend)
  const mensajes: Record<keyof Touched, string | undefined> = {
    nombre: v.nombrePersona(nombre, 'nombre'),
    apellido: v.nombrePersona(apellido, 'apellido'),
    email: v.email(email),
    password: password === '' ? 'La contraseña es obligatoria' : v.passwordNueva(password),
    confirmPassword:
      confirmPassword === ''
        ? 'Debes confirmar tu contraseña'
        : confirmPassword !== password
          ? 'Las contraseñas no coinciden'
          : undefined,
  };

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));
  const formInvalid = Object.values(mensajes).some(Boolean);
  const errorDe = (field: keyof Touched) => ((submitted || touched[field]) && mensajes[field]) || undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setRegisterError('');

    if (formInvalid || sending) return;

    setSending(true);
    try {
      const creado = await register(email, password, nombre, apellido);
      registrarEvento('sign_up', { method: 'email' });
      if (creado.emailVerified) {
        // Entorno sin validación de mail: entra directo y completa sus datos
        await login(email, password);
        const destino = destinoSeguro(volver, '/');
        navigate(`/datos?volver=${encodeURIComponent(destino)}`);
        return;
      }
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
      invertida
      etiqueta="Mi cuenta"
      titulo={<em>Registrarse</em>}
      origen="registro"
    >
      {/* Con Google la cuenta queda creada y con el mail verificado: solo
          falta que complete sus datos para poder ofertar */}
      <BotonGoogle
        texto="signup_with"
        onIngreso={(u) => {
          const destino = destinoSeguro(volver, '/');
          navigate(u.profileComplete ? destino : `/datos?volver=${encodeURIComponent(destino)}`);
        }}
      />
      <form className={estilos.formulario} onSubmit={onSubmit} noValidate>
        {registerError && <Aviso tipo="error">{registerError}</Aviso>}

        <div className={styles.fila}>
          <Campo
            etiqueta="Nombre"
            autoComplete="given-name"
            maxLength={v.LARGOS.nombre}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => markTouched('nombre')}
            error={errorDe('nombre')}
          />
          <Campo
            etiqueta="Apellido"
            autoComplete="family-name"
            maxLength={v.LARGOS.nombre}
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
          maxLength={v.LARGOS.email}
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
          maxLength={v.LARGOS.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => markTouched('password')}
          error={errorDe('password')}
        />

        <Campo
          etiqueta="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          maxLength={v.LARGOS.password}
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

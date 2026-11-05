import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PantallaAuth from '../../components/auth/PantallaAuth';
import estilos from '../../components/auth/PantallaAuth.module.scss';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import Campo from '../../components/ui/Campo';
import { api, ApiError } from '../../services/api';

function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Dos usos (sin wireframe: usan el mismo layout que Login):
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

  const errorEmail = !submitted
    ? undefined
    : errors.required
      ? 'El correo es obligatorio'
      : errors.email
        ? 'Ingrese un correo válido'
        : undefined;

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
    <PantallaAuth
      etiqueta="Mi cuenta"
      titulo={
        <>
          Recuperar <em>contraseña</em>
        </>
      }
      bajada="Ingresá tu correo electrónico y te enviaremos las instrucciones para restablecer tu contraseña."
      origen="forgot-password"
    >
      <form className={estilos.formulario} onSubmit={onSubmit} noValidate>
        <Campo
          etiqueta="Correo electrónico"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorEmail}
        />

        {successMessage && <Aviso tipo="ok">{successMessage}</Aviso>}
        {errorMessage && <Aviso tipo="error">{errorMessage}</Aviso>}

        <div className={estilos.acciones}>
          <Boton variante="verde" type="submit" bloque disabled={sending}>
            {sending ? 'Enviando...' : 'Enviar instrucciones'}
          </Boton>
        </div>

        <Link to="/login" className={estilos.enlace}>
          Volver al inicio de sesión
        </Link>
      </form>
    </PantallaAuth>
  );
}

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
    <PantallaAuth
      etiqueta="Mi cuenta"
      titulo={
        <>
          Nueva <em>contraseña</em>
        </>
      }
      origen="forgot-password"
    >
      {done ? (
        <div className={estilos.formulario}>
          <Aviso tipo="ok">Contraseña actualizada. Ya podés iniciar sesión.</Aviso>
          <div className={estilos.acciones}>
            <Boton variante="verde" bloque to="/login">
              Iniciar sesión
            </Boton>
          </div>
        </div>
      ) : (
        <form className={estilos.formulario} onSubmit={onSubmit} noValidate>
          <Campo
            etiqueta="Contraseña nueva"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={submitted && errors.minlength ? 'Mínimo 8 caracteres' : undefined}
          />

          <Campo
            etiqueta="Repite la contraseña"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={submitted && errors.mismatch ? 'Las contraseñas no coinciden' : undefined}
          />

          {errorMessage && <Aviso tipo="error">{errorMessage}</Aviso>}

          <div className={estilos.acciones}>
            <Boton variante="verde" type="submit" bloque disabled={sending}>
              {sending ? 'Guardando...' : 'Guardar contraseña'}
            </Boton>
          </div>

          <Link to="/login" className={estilos.enlace}>
            Volver al inicio de sesión
          </Link>
        </form>
      )}
    </PantallaAuth>
  );
}

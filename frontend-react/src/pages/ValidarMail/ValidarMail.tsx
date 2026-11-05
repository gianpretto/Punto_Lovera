import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PantallaAuth from '../../components/auth/PantallaAuth';
import estilos from '../../components/auth/PantallaAuth.module.scss';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { api, ApiError } from '../../services/api';
import { useAuth, type User } from '../../services/AuthContext';

type Estado = 'pendiente' | 'verificando' | 'verificado' | 'error';

// Sobre de mail (trazo verde, mismo estilo que los íconos de Figma)
function IconoSobre() {
  return (
    <div className={estilos.icono} aria-hidden="true">
      <svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="3" y="7" width="28" height="20" />
        <path d="M3 8l14 11L31 8" />
      </svg>
    </div>
  );
}

// Dos usos (sin wireframe: usan el mismo layout que Login):
//  - /validar-mail             → después de registrarse: "revisá tu mail" + reenviar
//  - /validar-mail?token=...   → link del mail: confirma la cuenta contra el backend
export default function ValidarMail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  const [estado, setEstado] = useState<Estado>(token ? 'verificando' : 'pendiente');
  const [mensaje, setMensaje] = useState('');
  const [reenviado, setReenviado] = useState(false);
  const pedido = useRef(false);
  const navigate = useNavigate();
  const { setSession } = useAuth();

  useEffect(() => {
    // StrictMode monta dos veces en dev: el token es de un solo uso
    if (!token || pedido.current) return;
    pedido.current = true;
    api
      .post<{ token?: string; user?: User }>('/auth/verify-email', { token })
      .then((res) => {
        setEstado('verificado');
        // Diagrama: verificar correo → completar datos personales
        if (res.token && res.user) {
          setSession(res.token, res.user);
          setTimeout(() => navigate('/datos'), 2500);
        }
      })
      .catch((err) => {
        setEstado('error');
        setMensaje(err instanceof ApiError ? err.message : 'No se pudo verificar la cuenta.');
      });
  }, [token, setSession, navigate]);

  const resendEmail = async () => {
    if (!email) return;
    try {
      await api.post('/auth/resend-verification', { email });
      setReenviado(true);
    } catch (err) {
      setMensaje(err instanceof ApiError ? err.message : 'No se pudo reenviar el correo.');
    }
  };

  const titulo = (
    <>
      Validar <em>email</em>
    </>
  );

  if (token) {
    return (
      <PantallaAuth etiqueta="Mi cuenta" titulo={titulo} origen="validar-mail">
        <IconoSobre />

        <div className={estilos.formulario} aria-live="polite">
          {estado === 'verificando' && <p className={estilos.texto}>Verificando tu cuenta...</p>}
          {estado === 'verificado' && (
            <Aviso tipo="ok">
              ¡Listo! Tu cuenta quedó verificada. Ahora completá tus datos para poder participar.
            </Aviso>
          )}
          {estado === 'error' && <Aviso tipo="error">{mensaje}</Aviso>}

          <div className={estilos.acciones}>
            {estado === 'verificado' ? (
              <Boton variante="verde" bloque flecha to="/datos">
                Completar mis datos
              </Boton>
            ) : (
              <Boton variante="verde" bloque to="/login">
                Iniciar sesión
              </Boton>
            )}
          </div>
        </div>
      </PantallaAuth>
    );
  }

  return (
    <PantallaAuth etiqueta="Mi cuenta" titulo={titulo} origen="validar-mail">
      <IconoSobre />

      <p className={estilos.texto}>
        Te hemos enviado un correo electrónico para confirmar tu cuenta. Por favor, revisá tu bandeja de entrada y
        seguí las instrucciones que allí se indican.
      </p>
      <p className={`${estilos.texto} ${estilos.textoSecundario}`}>Si no lo encontrás, revisá tu carpeta de spam.</p>

      <div className={estilos.formulario}>
        {reenviado && <Aviso tipo="ok">Correo de verificación reenviado.</Aviso>}
        {mensaje && <Aviso tipo="error">{mensaje}</Aviso>}

        {email && (
          <div className={estilos.acciones}>
            <Boton variante="verde" bloque onClick={resendEmail}>
              Reenviar correo
            </Boton>
          </div>
        )}

        <Link to="/login" className={estilos.enlace}>
          Volver al inicio de sesión
        </Link>
      </div>
    </PantallaAuth>
  );
}

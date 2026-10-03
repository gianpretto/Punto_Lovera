import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../services/api';
import { useAuth, type User } from '../../services/AuthContext';
import styles from './ValidarMail.module.scss';

type Estado = 'pendiente' | 'verificando' | 'verificado' | 'error';

// Dos usos:
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

  if (token) {
    return (
      <div className={styles.validarWrapper}>
        <div className={styles.validarContent}>
          <h1 className={styles.validarTitle}>VALIDAR EMAIL</h1>
          <div className={styles.validarIcon}>✉️</div>

          {estado === 'verificando' && <p className={styles.validarDesc}>Verificando tu cuenta...</p>}
          {estado === 'verificado' && (
            <div className={styles.alertSuccess}>
              ¡Listo! Tu cuenta quedó verificada. Ahora completá tus datos para poder participar.
            </div>
          )}
          {estado === 'error' && <div className={styles.alertDanger}>{mensaje}</div>}

          <div className={styles.formActions}>
            {estado === 'verificado' ? (
              <Link to="/datos" className={`${styles.btn} ${styles.btnBlack}`}>Completar mis datos</Link>
            ) : (
              <Link to="/login" className={`${styles.btn} ${styles.btnBlack}`}>Iniciar sesión</Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.validarWrapper}>
      <div className={styles.validarContent}>
        <h1 className={styles.validarTitle}>VALIDAR EMAIL</h1>

        <div className={styles.validarIcon}>✉️</div>

        <p className={styles.validarDesc}>
          Te hemos enviado un correo electrónico para confirmar tu cuenta. Por favor, revisá tu bandeja de entrada y
          seguí las instrucciones que allí se indican.
        </p>

        <p className={styles.validarInfo}>Si no lo encontrás, revisá tu carpeta de spam.</p>

        {reenviado && <div className={styles.alertSuccess}>Correo de verificación reenviado.</div>}
        {mensaje && <div className={styles.alertDanger}>{mensaje}</div>}

        <div className={styles.formActions}>
          {email && (
            <button type="button" className={`${styles.btn} ${styles.btnBlack}`} onClick={resendEmail}>
              Reenviar correo
            </button>
          )}
          <Link to="/login" className={`${styles.btn} ${styles.btnLink}`}>Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../services/api';
import { useAuth, type User } from '../../services/AuthContext';
import Aviso from '../ui/Aviso';
import styles from './BotonGoogle.module.scss';
import { registrarEvento } from '../../services/analytics';

// "Continuar con Google" con el botón oficial de Google Identity Services.
// Google nos devuelve un ID token, el backend lo verifica (POST /auth/google)
// y responde con nuestra sesión, igual que el login común. El Client ID lo da
// el backend (GOOGLE_CLIENT_ID en Railway): si no está configurado, el botón
// no se muestra.

interface GoogleId {
  initialize(config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT_GSI = 'https://accounts.google.com/gsi/client';

// Se piden una sola vez por carga de la página (login y registro los comparten)
let configPromise: Promise<string | null> | null = null;
let scriptPromise: Promise<void> | null = null;

function obtenerClientId() {
  configPromise ??= api
    .get<{ clientId: string | null }>('/auth/google/config')
    .then((r) => r.clientId)
    .catch(() => null);
  return configPromise;
}

function cargarScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_GSI;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('No se pudo cargar Google'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  /** Texto del botón: "Continuar con Google" (login) o "Registrarse con Google" */
  texto?: 'continue_with' | 'signup_with';
  /** Se llama con la sesión ya guardada; `nuevo` = la cuenta se acaba de crear */
  onIngreso: (user: User, nuevo: boolean) => void;
}

export default function BotonGoogle({ texto = 'continue_with', onIngreso }: Props) {
  const { setSession } = useAuth();
  const contenedor = useRef<HTMLDivElement>(null);
  const [disponible, setDisponible] = useState(false);
  const [error, setError] = useState('');
  // El callback de Google se registra una vez: que use siempre la última versión
  const alIngresar = useRef(onIngreso);
  useEffect(() => {
    alIngresar.current = onIngreso;
  });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const clientId = await obtenerClientId();
      if (!clientId || cancelado) return;
      try {
        await cargarScript();
      } catch {
        return; // sin Google (bloqueado o sin conexión): queda el login común
      }
      const gsi = window.google?.accounts.id;
      if (cancelado || !gsi || !contenedor.current) return;
      setDisponible(true);
      gsi.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        callback: async ({ credential }) => {
          setError('');
          try {
            const { token, user, isNew } = await api.post<{ token: string; user: User; isNew: boolean }>(
              '/auth/google',
              { credential }
            );
            setSession(token, user);
            registrarEvento(isNew ? 'sign_up' : 'login', { method: 'google' });
            alIngresar.current(user, isNew);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo ingresar con Google. Probá de nuevo.');
          }
        },
      });
      gsi.renderButton(contenedor.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: texto,
        logo_alignment: 'center',
        locale: 'es',
        // Google acepta hasta 400 px; se mide la columna del formulario porque
        // este bloque todavía está oculto (display: none) en este momento
        width: Math.min(400, contenedor.current.parentElement?.parentElement?.offsetWidth || 320),
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [texto, setSession]);

  return (
    <div className={disponible ? styles.google : styles.oculto}>
      <div ref={contenedor} className={styles.boton} />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className={styles.separador}>
        <span>o con tu correo</span>
      </p>
    </div>
  );
}

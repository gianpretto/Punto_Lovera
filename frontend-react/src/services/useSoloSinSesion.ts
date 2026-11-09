import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { destinoSeguro } from './destinoSeguro';

/**
 * Login y Registro son solo para quien no tiene sesión: si al entrar ya está
 * logueado, se lo manda a `?volver=` (si es una ruta interna) o al inicio.
 * Se decide una sola vez, cuando se confirma la sesión al cargar: si inicia
 * sesión desde la misma pantalla, la redirección la maneja el formulario.
 */
export function useSoloSinSesion() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const decidido = useRef(false);

  useEffect(() => {
    if (loading || decidido.current) return;
    decidido.current = true;
    if (!user) return;
    const volver = searchParams.get('volver');
    navigate(destinoSeguro(volver, '/'), { replace: true });
  }, [loading, user, navigate, searchParams]);
}

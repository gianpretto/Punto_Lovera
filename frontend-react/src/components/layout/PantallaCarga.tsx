import { useEffect } from 'react';
import { useAuth } from '../../services/AuthContext';

// Saca la pantalla de carga de index.html (#splash, el logo) cuando la app ya
// sabe si hay sesión, con un fundido corto. No dibuja nada.
export default function PantallaCarga() {
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('fuera');
    const t = setTimeout(() => splash.remove(), 300);
    return () => clearTimeout(t);
  }, [loading]);

  return null;
}

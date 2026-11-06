import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import type { AuctionsPage } from '../../services/auctions';

// /martillero: atajo del menú al panel del martillero de la subasta en vivo
// (o, si no hay ninguna, de la próxima). Sin subastas → lista del admin.
export default function IrAlPanel() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const puede = user?.role === 'MARTILLERO' || user?.role === 'ADMIN';

  useEffect(() => {
    if (loading) return;
    if (!puede) {
      navigate(user ? '/' : '/login', { replace: true });
      return;
    }
    api
      .get<AuctionsPage>('/subastas?status=ACTIVA,PROXIMA&page=1&pageSize=1')
      .then(({ auctions }) =>
        navigate(auctions[0] ? `/subastas/${auctions[0].id}/martillero` : '/admin/subastas', { replace: true }),
      )
      .catch(() => navigate('/admin/subastas', { replace: true }));
  }, [loading, puede, user, navigate]);

  return null;
}

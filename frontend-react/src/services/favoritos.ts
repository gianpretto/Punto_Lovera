import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';

// Lotes favoritos del usuario (GET/POST/DELETE /favoritos). Sin sesión no
// hay favoritos: `activo` es false y la tarjeta no muestra el corazón.
export function useFavoritos() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let vigente = true;
    api
      .get<{ lotIds: string[] }>('/favoritos/ids')
      .then((r) => vigente && setIds(new Set(r.lotIds)))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [user]);

  const alternar = useCallback(
    async (lotId: string) => {
      const era = ids.has(lotId);
      // Optimista: el corazón cambia al toque y vuelve si falla
      setIds((prev) => {
        const nuevo = new Set(prev);
        if (era) nuevo.delete(lotId);
        else nuevo.add(lotId);
        return nuevo;
      });
      try {
        if (era) await api.delete(`/favoritos/${lotId}`);
        else await api.post(`/favoritos/${lotId}`, {});
      } catch {
        setIds((prev) => {
          const nuevo = new Set(prev);
          if (era) nuevo.add(lotId);
          else nuevo.delete(lotId);
          return nuevo;
        });
      }
    },
    [ids]
  );

  return { activo: Boolean(user), esFavorito: (id: string) => ids.has(id), alternar };
}

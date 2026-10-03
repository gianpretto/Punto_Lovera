import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, getToken, setToken } from './api';

// Auth real contra el backend (JWT). El token se guarda en localStorage y
// api.ts lo manda en cada request; al montar se valida con GET /auth/me.

export type UserRole = 'USER' | 'MARTILLERO' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dni: string | null;
  birthDate: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zipCode: string | null;
  role: UserRole;
  emailVerified: boolean;
  /** Saldo total cargado (comprobantes aprobados - compras) */
  creditBalance: number;
  /** Reservado en lotes que va ganando (se libera si lo superan) */
  heldCredit: number;
  /** Lo que puede usar para pujar: creditBalance - heldCredit */
  availableCredit: number;
}

export interface UpdateUserData {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  dni?: string;
  fechaNacimiento?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  cp?: string;
}

interface AuthContextValue {
  user: User | null;
  /** Nombre para mostrar (header). null si no hay sesión. */
  currentUser: string | null;
  /** true mientras se valida el token guardado al cargar la app. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nombre: string, apellido: string) => Promise<void>;
  logout: () => void;
  updateUserData: (data: UpdateUserData) => Promise<void>;
  /** Vuelve a pedir el usuario (ej: después de que cambie el saldo). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const { user } = await api.get<{ user: User }>('/auth/me');
      setUser(user);
    } catch (err) {
      // Token vencido o inválido: cerramos sesión. Si es un error de red
      // dejamos el token para reintentar en la próxima carga.
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(token);
    setUser(user);
  }, []);

  const register = useCallback(async (email: string, password: string, nombre: string, apellido: string) => {
    await api.post('/auth/register', { email, password, firstName: nombre, lastName: apellido });
    // No logueamos todavía, se espera la validación de mail
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const updateUserData = useCallback(async (data: UpdateUserData) => {
    const { user } = await api.patch<{ user: User }>('/auth/me', {
      firstName: data.nombre,
      lastName: data.apellido,
      phone: data.telefono,
      dni: data.dni,
      birthDate: data.fechaNacimiento,
      address: data.direccion,
      city: data.ciudad,
      province: data.provincia,
      zipCode: data.cp,
    });
    setUser(user);
  }, []);

  const currentUser = user ? user.firstName || user.email : null;

  return (
    <AuthContext.Provider
      value={{ user, currentUser, loading, login, register, logout, updateUserData, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  return ctx;
}

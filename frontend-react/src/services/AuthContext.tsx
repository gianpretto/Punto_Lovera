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
  /** Reservado: lotes que va ganando (se libera si lo superan) + reintegros pendientes */
  heldCredit: number;
  /** Lo que puede usar para pujar: creditBalance - heldCredit */
  availableCredit: number;
  /** Cargó todos sus datos personales (requisito para ofertar) */
  profileComplete: boolean;
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
  /** Devuelve el usuario creado (emailVerified = true si el entorno no pide validar el mail) */
  register: (email: string, password: string, nombre: string, apellido: string) => Promise<User>;
  logout: () => void;
  updateUserData: (data: UpdateUserData) => Promise<void>;
  /** Vuelve a pedir el usuario (ej: después de que cambie el saldo). */
  refreshUser: () => Promise<boolean>;
  /** Inicia sesión con un token ya emitido (ej: al verificar el mail). */
  setSession: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  /** true si quedó resuelto (usuario cargado o sesión vencida); false si falló la red */
  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return true;
    }
    try {
      const { user } = await api.get<{ user: User }>('/auth/me');
      setUser(user);
      return true;
    } catch (err) {
      // Token vencido o inválido: cerramos sesión. Si es un error de red
      // dejamos el token para reintentar en la próxima carga.
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        setToken(null);
        setUser(null);
        return true;
      }
      return false;
    }
  }, []);

  // Al cargar la página: si hay token se confirma la sesión. Si la red falla
  // (backend despertando, conexión lenta) se reintenta antes de mostrar la
  // web como si no hubiera sesión.
  useEffect(() => {
    if (!getToken()) return;
    let cancelado = false;
    (async () => {
      for (let intento = 0; intento < 3 && !cancelado; intento++) {
        if (await refreshUser()) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelado) setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(token);
    setUser(user);
  }, []);

  const register = useCallback(async (email: string, password: string, nombre: string, apellido: string) => {
    const { user } = await api.post<{ user: User }>('/auth/register', {
      email,
      password,
      firstName: nombre,
      lastName: apellido,
    });
    // No logueamos todavía: se espera la validación de mail (salvo en
    // entornos de prueba sin SMTP, donde la cuenta ya viene validada)
    return user;
  }, []);

  const setSession = useCallback((token: string, user: User) => {
    setToken(token);
    setUser(user);
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
      value={{ user, currentUser, loading, login, register, logout, updateUserData, refreshUser, setSession }}
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

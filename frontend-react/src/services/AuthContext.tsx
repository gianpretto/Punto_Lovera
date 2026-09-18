import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// Puerto 1:1 del AuthService "mock" que ya tenía el front en Angular
// (localStorage, sin backend real todavía). Cuando conectemos el backend
// de verdad, solo cambia lo de adentro de este archivo — los componentes
// que usan useAuth() no se tocan.

export interface UpdateUserData {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  dni?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  cp?: string;
}

interface AuthContextValue {
  currentUser: string | null;
  login: (email: string, password: string) => boolean;
  register: (email: string, password: string, nombre: string, apellido: string) => void;
  logout: () => void;
  updateUserData: (data: UpdateUserData) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string | null>(() =>
    localStorage.getItem('currentUser')
  );

  const register = useCallback((email: string, password: string, nombre: string, apellido: string) => {
    localStorage.setItem('registeredEmail', email);
    localStorage.setItem('registeredPassword', password);
    localStorage.setItem('registeredName', nombre);
    localStorage.setItem('registeredLastname', apellido);
    // No logueamos todavía, se espera la validación de mail
  }, []);

  const login = useCallback((email: string, password: string) => {
    const storedEmail = localStorage.getItem('registeredEmail');
    const storedPass = localStorage.getItem('registeredPassword');
    const storedName = localStorage.getItem('registeredName');

    if (email === storedEmail && password === storedPass) {
      const displayValue = storedName ? storedName : email;
      localStorage.setItem('currentUser', displayValue);
      setCurrentUser(displayValue);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  }, []);

  const updateUserData = useCallback((data: UpdateUserData) => {
    if (data.nombre) localStorage.setItem('registeredName', data.nombre);
    if (data.apellido) localStorage.setItem('registeredLastname', data.apellido);
    if (data.telefono) localStorage.setItem('registeredPhone', data.telefono);
    if (data.dni) localStorage.setItem('registeredDni', data.dni);
    if (data.direccion) localStorage.setItem('registeredAddress', data.direccion);
    if (data.ciudad) localStorage.setItem('registeredCity', data.ciudad);
    if (data.provincia) localStorage.setItem('registeredProvince', data.provincia);
    if (data.cp) localStorage.setItem('registeredZip', data.cp);

    if (data.nombre) {
      localStorage.setItem('currentUser', data.nombre);
      setCurrentUser(data.nombre);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, updateUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  return ctx;
}

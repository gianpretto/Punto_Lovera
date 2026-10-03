// Cliente HTTP mínimo contra el backend (backend/, Express).
//
// En desarrollo las llamadas van a rutas relativas (/api/...) y Vite las
// proxea a http://localhost:4000 (ver vite.config.ts), así no hay CORS.
// En producción se puede apuntar a otro host con VITE_API_URL.

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const TOKEN_KEY = 'authToken';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Error de la API con el mensaje que manda el backend ({ error: '...' }). */
export class ApiError extends Error {
  status: number;
  details?: { path: string; message: string }[];

  constructor(message: string, status: number, details?: { path: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Intentá de nuevo en unos minutos.', 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Si hay detalle de validación (zod), mostramos el primer mensaje concreto.
    const detail = data?.details?.[0]?.message as string | undefined;
    throw new ApiError(detail ?? data?.error ?? 'Ocurrió un error inesperado', res.status, data?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** URL pública de un archivo subido al backend (/uploads/...). */
export function uploadUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}

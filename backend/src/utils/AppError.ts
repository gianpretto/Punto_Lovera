// Error de dominio con status HTTP, para que el middleware de errores
// sepa qué código devolver sin tener que adivinar.
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

export const Errors = {
  notFound: (what: string) => new AppError(`${what} no encontrado`, 404),
  unauthorized: (msg = 'No autenticado') => new AppError(msg, 401),
  forbidden: (msg = 'No tenés permiso para esta acción') => new AppError(msg, 403),
  badRequest: (msg: string) => new AppError(msg, 400),
  conflict: (msg: string) => new AppError(msg, 409),
};

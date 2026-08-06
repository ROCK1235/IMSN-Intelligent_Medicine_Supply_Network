/**
 * Operational error with an HTTP status code, thrown from services/controllers
 * and translated into a JSON response by the global error handler.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erreur applicative avec code HTTP associé.
 * À utiliser partout où tu veux renvoyer une erreur maîtrisée.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number = 400,
    errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;

    // Nécessaire pour que instanceof fonctionne correctement avec TS
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError";
import { env } from "../../config/env";

/**
 * Middleware global de gestion d'erreurs.
 * À brancher EN DERNIER dans app.ts (après toutes les routes).
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Erreur applicative connue
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  // Erreur JSON malformée (body parser)
  if (err.name === "SyntaxError" && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Corps de requête JSON invalide",
    });
  }

  // Erreur inconnue
  console.error("❌ Erreur non gérée :", err);

  return res.status(500).json({
    success: false,
    message: "Erreur serveur",
    ...(env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}
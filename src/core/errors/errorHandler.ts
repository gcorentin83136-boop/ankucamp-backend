import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Erreur applicative connue
  if (err instanceof AppError) {
    logger.warn(
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: err.statusCode,
        message: err.message,
      },
      "AppError"
    );

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  // Erreur JSON malformée
  if (err.name === "SyntaxError" && "body" in err) {
    logger.warn({ url: req.originalUrl }, "JSON invalide");
    return res.status(400).json({
      success: false,
      message: "Corps de requête JSON invalide",
    });
  }

  // Erreur inconnue
  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
    },
    "❌ Erreur non gérée"
  );

  return res.status(500).json({
    success: false,
    message: "Erreur serveur",
    ...(env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}
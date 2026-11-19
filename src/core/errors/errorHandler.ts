import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import {
  captureException,
  clearSentryUser,
  isSentryEnabled,
  setSentryUser,
} from "../../config/sentry";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // ============================================================
  // SENTRY : capture des erreurs 5xx uniquement
  // ============================================================
  if (isSentryEnabled && err instanceof Error) {
    const statusCode = err instanceof AppError ? err.statusCode : 500;

    if (statusCode >= 500) {
      // Attache le user si disponible
      const user = (req as any).user;
      if (user?.id) {
        setSentryUser({
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        });
      }

      captureException(err, {
        url: req.originalUrl,
        method: req.method,
        user_id: user?.id,
      });
    }
  }

  // Erreur applicative connue (4xx / 5xx volontaires)
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
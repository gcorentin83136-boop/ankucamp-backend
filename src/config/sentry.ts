import * as Sentry from "@sentry/node";
import { env } from "./env";
import { logger } from "./logger";

// ============================================================
// INIT SENTRY
// ============================================================

export const isSentryEnabled = !!env.SENTRY_DSN;

export function initSentry() {
  if (!isSentryEnabled) {
    logger.info("ℹ️  Sentry désactivé (SENTRY_DSN non défini)");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    ignoreErrors: [
      "Token invalide",
      "Token manquant",
      "Non authentifié",
      "Non authentifie",
      "Accès interdit",
      "Acces interdit",
    ],
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  logger.info({ env: env.SENTRY_ENVIRONMENT }, "✅ Sentry initialisé");
}

// ============================================================
// HELPERS
// ============================================================

export function setSentryUser(user: {
  id: number;
  email?: string;
  username?: string;
  role?: string;
}) {
  if (!isSentryEnabled) return;
  Sentry.setUser({
    id: String(user.id),
    email: user.email,
    username: user.username,
    role: user.role,
  });
}

export function clearSentryUser() {
  if (!isSentryEnabled) return;
  Sentry.setUser(null);
}

export function captureException(err: unknown, context?: Record<string, any>) {
  if (!isSentryEnabled) {
    logger.error({ err, context }, "Erreur capturée (Sentry off)");
    return;
  }
  Sentry.captureException(err, { extra: context });
}

export function sentryUserMiddleware(req: any, _res: any, next: any) {
  if (!isSentryEnabled) return next();
  if (req.user?.id) {
    setSentryUser({
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
    });
  }
  next();
}
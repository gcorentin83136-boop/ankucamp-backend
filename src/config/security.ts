import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "./env";

const isTest = env.NODE_ENV === "test";
const isDev = env.NODE_ENV === "development";

// ============================================================
// HELPERS
// ============================================================

/**
 * Crée un limiter avec comportement adapté au mode test.
 *
 * En test :
 *   - Le limiter est SKIPPÉ par défaut (pour ne pas casser les autres tests)
 *   - Il s'active UNIQUEMENT si le header `x-test-ratelimit: active` est présent
 *   - La clé est isolée par header `x-test-client` (pour tester plusieurs "clients")
 *   - La limite est abaissée (testLimit) pour des tests rapides
 *
 * En prod/dev :
 *   - Le limiter s'applique normalement
 *   - La clé est par user (si dispo) ou par IP
 */
function createConditionalLimiter(opts: {
  windowMs: number;
  limit: number;
  testLimit: number;
  message: string;
  keyBy?: "user" | "ip";
}) {
  const { windowMs, limit, testLimit, message, keyBy = "ip" } = opts;

  return rateLimit({
    windowMs,
    limit: isTest ? testLimit : limit,
    standardHeaders: true,
    legacyHeaders: false,

    // En test : skip sauf si le client active explicitement
    skip: (req) => {
      if (isTest && req.headers["x-test-ratelimit"] !== "active") {
        return true;
      }
      return false;
    },

    // En test : clé isolée par client (header x-test-client)
    keyGenerator: (req) => {
      if (isTest) {
        return String(req.headers["x-test-client"] ?? "default");
      }
      if (keyBy === "user") {
        const authReq = req as any;
        if (authReq.user?.id) return `user:${authReq.user.id}`;
      }
      // ✅ Utilise le helper officiel pour normaliser les IPv6
      return ipKeyGenerator(req.ip ?? "unknown");
    },

    message: { success: false, message },
  });
}

// ============================================================
// GLOBAL
// ============================================================

/**
 * Rate limit global.
 * - dev  : 10 000 requêtes / 15 min (pour ne pas gêner le développement)
 * - prod : 100 requêtes / 15 min par IP
 * - test : 10 000 (les tests pilotent via header)
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest || isDev ? 10_000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Trop de requêtes, veuillez réessayer plus tard",
  },
});

/**
 * Rate limit strict pour l'auth.
 * - dev  : 100 tentatives / 15 min (pour ne pas se bloquer en testant)
 * - prod : 5 tentatives ÉCHOUÉES / 15 min
 * - test : 10 000
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest || isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: !isTest,
  message: {
    success: false,
    message: "Trop de tentatives de connexion, réessayez dans 15 minutes",
  },
});

// ============================================================
// LIMITERS CIBLÉS PAR ROUTE
// ============================================================

/**
 * Search : 30 requêtes / minute par user/IP.
 * Protège contre le scraping et les abus de recherche.
 */
export const searchLimiter = createConditionalLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  testLimit: 3,
  message: "Trop de recherches, réessayez dans 1 minute",
});

/**
 * Uploads : 10 uploads / minute par user.
 * Protège contre l'abus de stockage (Cloudinary coûte cher).
 */
export const uploadsLimiter = createConditionalLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  testLimit: 3,
  message: "Trop d'uploads, réessayez dans 1 minute",
  keyBy: "user",
});

/**
 * Refunds : 5 demandes / heure par user.
 * Protège contre le spam de demandes de remboursement.
 */
export const refundsLimiter = createConditionalLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  testLimit: 2,
  message: "Trop de demandes de remboursement, réessayez dans 1 heure",
  keyBy: "user",
});

/**
 * Checkout : 10 tentatives / heure par user.
 * Protège contre les abus de paiement.
 */
export const checkoutLimiter = createConditionalLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  testLimit: 2,
  message: "Trop de tentatives de paiement, réessayez dans 1 heure",
  keyBy: "user",
});

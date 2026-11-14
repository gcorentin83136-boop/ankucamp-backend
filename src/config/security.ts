import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "./env";

const isTest = env.NODE_ENV === "test";
const isDev = env.NODE_ENV === "development";

// ============================================================
// HELPERS
// ============================================================

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
    skip: (req) => {
      // 🆕 En test, on skip sauf si le test active explicitement le limiteur
      if (isTest && req.headers["x-test-ratelimit"] !== "active") {
        return true;
      }
      return false;
    },
    keyGenerator: (req) => {
      if (isTest) {
        // 🆕 On isole chaque client de test via un header
        return String(req.headers["x-test-client"] ?? "default");
      }
      if (keyBy === "user") {
        const authReq = req as any;
        if (authReq.user?.id) return `user:${authReq.user.id}`;
      }
      return ipKeyGenerator(req.ip ?? "unknown");
    },
    message: { success: false, message },
  });
}

// ============================================================
// GLOBAL
// ============================================================

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

export const searchLimiter = createConditionalLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  testLimit: 3,
  message: "Trop de recherches, réessayez dans 1 minute",
});

export const uploadsLimiter = createConditionalLimiter({
  windowMs: 60 * 1000,
  limit: 50,
  testLimit: 3,
  message: "Trop d'uploads, réessayez dans 1 minute",
  keyBy: "user",
});

export const refundsLimiter = createConditionalLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 500,
  testLimit: 2,
  message: "Trop de demandes de remboursement, réessayez dans 1 heure",
  keyBy: "user",
});

export const checkoutLimiter = createConditionalLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  testLimit: 2,
  message: "Trop de tentatives de paiement, réessayez dans 1 heure",
  keyBy: "user",
});
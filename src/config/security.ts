import rateLimit from "express-rate-limit";
import { env } from "./env";

const isTest = env.NODE_ENV === "test";

/**
 * Rate limit global : 100 requêtes / 15 min par IP.
 * Désactivé en mode test pour ne pas bloquer les suites de tests.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10_000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Trop de requêtes, veuillez réessayer plus tard",
  },
});

/**
 * Rate limit strict pour l'auth : 5 tentatives ÉCHOUÉES / 15 min.
 * Désactivé en mode test pour ne pas bloquer les suites de tests.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: !isTest,
  message: {
    success: false,
    message: "Trop de tentatives de connexion, réessayez dans 15 minutes",
  },
});
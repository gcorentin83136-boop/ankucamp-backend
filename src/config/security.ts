import rateLimit from "express-rate-limit";

/**
 * Rate limit global : 100 requêtes / 15 min par IP.
 * Protège contre le spam basique et les scrapers.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Trop de requêtes, veuillez réessayer plus tard",
  },
});

/**
 * Rate limit strict pour l'auth : 5 tentatives ÉCHOUÉES / 15 min.
 * Empêche le brute-force de mot de passe.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Trop de tentatives de connexion, réessayez dans 15 minutes",
  },
});
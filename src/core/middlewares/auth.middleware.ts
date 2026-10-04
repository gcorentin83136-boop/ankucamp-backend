import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { verifyToken } from "../security/jwt";
import { db } from "../db";
import { users } from "../db/schema";

export interface AuthRequest extends Request {
  user?: Express.User;
}

/**
 * Middleware d'authentification obligatoire.
 *
 * ✅ Vérifie le JWT
 * ✅ Vérifie que le compte existe toujours en BDD
 * ✅ Vérifie que le compte n'est pas désactivé (email_verified === -1)
 *
 * → Un compte désactivé est immédiatement rejeté (401),
 *   même si son JWT est encore valide.
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Token manquant" });
  }

  const token = header.split(" ")[1];

  // 1. Vérifier le JWT
  let payload: any;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ success: false, message: "Token invalide" });
  }

  // 2. Vérifier l'état du compte en BDD
  try {
    const [user] = await db
      .select({ id: users.id, email_verified: users.email_verified })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Compte introuvable" });
    }

    if (user.email_verified === -1) {
      return res.status(401).json({
        success: false,
        message: "Compte désactivé. Reconnecte-toi pour le réactiver.",
      });
    }

    req.user = payload;
    next();
  } catch (err) {
    console.error("❌ Erreur authMiddleware:", err);
    return res
      .status(500)
      .json({ success: false, message: "Erreur serveur" });
  }
}

/**
 * Middleware d'authentification OPTIONNELLE.
 * - Si token valide → req.user est rempli
 * - Si token manquant ou invalide → on continue sans req.user
 */
export function authOptionalMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
  } catch {
    // Token invalide → on ignore silencieusement
  }

  next();
}

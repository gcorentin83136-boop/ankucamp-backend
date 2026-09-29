import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../security/jwt";

export interface AuthRequest extends Request {
  user?: Express.User;
}

/**
 * Middleware d'authentification obligatoire.
 * Rejette si token manquant ou invalide.
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Token manquant" });
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token invalide" });
  }
}

/**
 * Middleware d'authentification OPTIONNELLE.
 * - Si token valide → req.user est rempli
 * - Si token manquant ou invalide → on continue sans req.user
 *
 * Utile pour les routes publiques qui ont un comportement enrichi
 * si l'utilisateur est authentifié (ex: profil privé visible par son propriétaire).
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
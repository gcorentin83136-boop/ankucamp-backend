import { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { verifyToken } from "../security/jwt";
import { db } from "../db";
import { users, userSessions } from "../db/schema";
import { hashToken } from "../api/settings/sessions/sessions.service";

export interface AuthRequest extends Request {
  user?: Express.User;
}

/**
 * Middleware d'authentification obligatoire.
 *
 * ✅ Vérifie le JWT (signature + expiration)
 * ✅ Vérifie que le compte existe toujours en BDD
 * ✅ Vérifie que le compte n'est pas désactivé (email_verified === -1)
 * ✅ Vérifie que la session existe toujours en BDD (révocation immédiate)
 *
 * → Révocation immédiate : dès que la session est supprimée de user_sessions,
 *   le JWT devient inutilisable même s'il est encore valide techniquement.
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

  try {
    // 2. Vérifier l'état du compte en BDD
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

    // 3. Vérifier que la session existe toujours en BDD
    const token_hash = hashToken(token);
    const [session] = await db
      .select({
        id: userSessions.id,
        expires_at: userSessions.expires_at,
      })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.user_id, user.id),
          eq(userSessions.token_hash, token_hash)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session expirée ou révoquée. Reconnecte-toi.",
      });
    }

    if (session.expires_at < new Date()) {
      // Session expirée en BDD → on la nettoie et on rejette
      await db.delete(userSessions).where(eq(userSessions.id, session.id));
      return res.status(401).json({
        success: false,
        message: "Session expirée. Reconnecte-toi.",
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
 * - Si token valide ET session active → req.user est rempli
 * - Si token manquant, invalide, ou session révoquée → on continue sans req.user
 */
export async function authOptionalMiddleware(
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

    // Vérifier que la session existe toujours (révocation immédiate)
    const token_hash = hashToken(token);
    const [session] = await db
      .select({ id: userSessions.id, expires_at: userSessions.expires_at })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.user_id, payload.id),
          eq(userSessions.token_hash, token_hash)
        )
      )
      .limit(1);

    if (session && session.expires_at >= new Date()) {
      req.user = payload;
    }
  } catch {
    // Token invalide ou révoqué → on ignore silencieusement
  }

  next();
}

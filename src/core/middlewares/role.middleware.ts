import { Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { AuthRequest } from "./auth.middleware";
import { db } from "../db";
import { users } from "../db/schema";

/**
 * Middleware de contrôle de rôle.
 *
 * ✅ Lit le rôle depuis la BDD (au lieu du JWT figé)
 * ✅ Refuse si user introuvable
 * ✅ Refuse si compte désactivé (email_verified === -1)
 *
 * → Le changement de rôle en BDD est pris en compte immédiatement,
 *   sans devoir se reconnecter.
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Non authentifié" });
    }

    try {
      const [user] = await db
        .select({ role: users.role, email_verified: users.email_verified })
        .from(users)
        .where(eq(users.id, req.user.id))
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

      // 🔑 Les admins bypass toutes les restrictions de rôle
      if (user.role === "admin") {
        return next();
      }

      if (!allowedRoles.includes(user.role)) {
        return res
          .status(403)
          .json({ success: false, message: "Accès interdit" });
      }

      next();
    } catch (err) {
      console.error("❌ Erreur requireRole:", err);
      return res
        .status(500)
        .json({ success: false, message: "Erreur serveur" });
    }
  };
}

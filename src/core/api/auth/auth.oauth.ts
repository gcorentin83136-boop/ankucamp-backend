import { Router, Request, Response } from "express";
import { passport } from "../../../config/passport";
import { signToken } from "../../security/jwt";
import { env } from "../../../config/env";
import { createSession } from "../settings/sessions/sessions.service";

const router = Router();

// URL du frontend selon l'environnement
const FRONTEND_URL =
  env.NODE_ENV === "development"
    ? "http://localhost:5173"
    : "https://ankucamp.com";

// ============================================================
// GET /auth/google
// Redirige vers Google pour l'autorisation
// ============================================================
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// ============================================================
// GET /auth/google/callback
// Google renvoie ici apres autorisation
// ============================================================
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
  }),
  async (req: Request, res: Response) => {
    const user = req.user as any;

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_user`);
    }

    // Generer le JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Creer la session en BDD (le authMiddleware la verifie a chaque requete)
    try {
      await createSession(user.id, token, req);
    } catch (err) {
      console.error("Erreur creation session OAuth:", err);
    }

    // Redirige vers le front avec le token dans l'URL
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

export default router;

import { Router, Request, Response } from "express";
import { passport } from "../../../config/passport";
import { signToken } from "../../security/jwt";
import { env } from "../../../config/env";

const router = Router();

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
// Google renvoie ici après autorisation
// ============================================================
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.NODE_ENV === "development" ? "http://localhost:3000" : "https://ankucamp.com"}/login?error=oauth_failed`,
  }),
  (req: Request, res: Response) => {
    const user = req.user as any;

    if (!user) {
      return res.redirect(
        `${env.NODE_ENV === "development" ? "http://localhost:3000" : "https://ankucamp.com"}/login?error=no_user`
      );
    }

    // Générer le JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // En prod, on redirige vers le front avec le token dans l'URL
    // ⚠️ Le front devra IMMÉDIATEMENT le stocker et le retirer de l'URL
    const frontendUrl =
      env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://ankucamp.com";

    return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
);

export default router;
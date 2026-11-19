import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  verify2FASetupSchema,
  disable2FASchema,
  validate2FALoginSchema,
} from "./2fa.validation";
import {
  get2FAStatus,
  setup2FA,
  verify2FASetup,
  disable2FA,
  validate2FALogin,
} from "./2fa.service";
import { signToken } from "../../../security/jwt";
import { createSession } from "../../settings/sessions/sessions.service";

// ============================================================
// GET /auth/2fa/status
// ============================================================

export async function status(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const result = await get2FAStatus(req.user.id);

  return res.json({ success: true, ...result });
}

// ============================================================
// POST /auth/2fa/setup
// ============================================================

export async function setup(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const result = await setup2FA(req.user.id);

  return res.json({
    success: true,
    message: "Scanne le QR code avec ton app TOTP, puis valide avec un code.",
    ...result,
  });
}

// ============================================================
// POST /auth/2fa/verify
// ============================================================

export async function verify(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = verify2FASetupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await verify2FASetup(req.user.id, parsed.data.code);

  return res.json({
    success: true,
    message:
      "2FA activée. Conserve ces codes de secours en lieu sûr : ils ne seront plus affichés.",
    ...result,
  });
}

// ============================================================
// POST /auth/2fa/disable
// ============================================================

export async function disable(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = disable2FASchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await disable2FA(
    req.user.id,
    parsed.data.password,
    parsed.data.code
  );

  return res.json({ success: true, message: "2FA désactivée", ...result });
}

// ============================================================
// POST /auth/2fa/validate (login étape 2, PAS d'auth requise)
// ============================================================

export async function validateLogin(req: AuthRequest, res: Response) {
  const parsed = validate2FALoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const user = await validate2FALogin(
    parsed.data.temp_token,
    parsed.data.code
  );

  // Génère le vrai JWT (comme le login normal)
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role as "professionnel" | "particulier" | "admin",
  });

  // Cree la session en BDD (le authMiddleware la verifie a chaque requete)
  try {
    await createSession(user.id, token, req);
  } catch (err) {
    console.error("Erreur creation session 2FA:", err);
  }

  return res.json({
    success: true,
    message: "Connexion réussie",
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      avatar_url: user.avatar_url,
    },
  });
}
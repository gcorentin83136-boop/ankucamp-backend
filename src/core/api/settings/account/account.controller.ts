import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  changeEmailSchema,
  changePasswordSchema,
  changeUsernameSchema,
  updateInfoSchema,
  deactivateAccountSchema,
} from "./account.validation";
import {
  getAccountInfo,
  changeEmail,
  changePassword,
  changeUsername,
  updatePersonalInfo,
  deactivateAccount,
} from "./account.service";

// ============================================================
// GET /settings/account
// ============================================================

export async function me(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const info = await getAccountInfo(req.user.id);

  return res.json({ success: true, account: info });
}

// ============================================================
// PUT /settings/account/email
// ============================================================

export async function putEmail(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = changeEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const updated = await changeEmail(req.user.id, parsed.data);

  return res.json({
    success: true,
    message:
      "Email modifié. Vérifie ta boîte de réception pour confirmer ta nouvelle adresse.",
    account: updated,
  });
}

// ============================================================
// PUT /settings/account/password
// ============================================================

export async function putPassword(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  await changePassword(req.user.id, parsed.data);

  return res.json({
    success: true,
    message:
      "Mot de passe modifié. Toutes tes sessions ont été révoquées par sécurité. Reconnecte-toi.",
  });
}

// ============================================================
// PUT /settings/account/username
// ============================================================

export async function putUsername(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = changeUsernameSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const updated = await changeUsername(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: `Username modifié en @${updated.username}`,
    account: updated,
  });
}

// ============================================================
// PUT /settings/account/info
// ============================================================

export async function putInfo(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = updateInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const updated = await updatePersonalInfo(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Informations modifiées",
    account: updated,
  });
}

// ============================================================
// DELETE /settings/account/deactivate
// ============================================================

export async function deactivate(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = deactivateAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  await deactivateAccount(req.user.id, parsed.data);

  return res.json({
    success: true,
    message:
      "Compte désactivé. Tu peux le réactiver à tout moment en te reconnectant.",
  });
}
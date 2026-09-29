import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  privacySchema,
  profileVisibilitySchema,
  messagesFromSchema,
} from "./privacy.validation";
import {
  getPrivacy,
  updateAllPrivacy,
  updateProfileVisibility,
  updateMessagesFrom,
} from "./privacy.service";

// ============================================================
// GET /settings/privacy
// ============================================================

export async function get(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const privacy = await getPrivacy(req.user.id);

  return res.json({ success: true, privacy });
}

// ============================================================
// PUT /settings/privacy
// ============================================================

export async function updateAll(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = privacySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const privacy = await updateAllPrivacy(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Paramètres de confidentialité mis à jour",
    privacy,
  });
}

// ============================================================
// PUT /settings/privacy/visibility
// ============================================================

export async function updateVisibility(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = profileVisibilitySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const privacy = await updateProfileVisibility(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: `Profil passé en mode ${parsed.data.profile_visibility}`,
    privacy,
  });
}

// ============================================================
// PUT /settings/privacy/messages
// ============================================================

export async function updateMessages(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = messagesFromSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const privacy = await updateMessagesFrom(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: `Messages acceptés depuis : ${parsed.data.allow_messages_from}`,
    privacy,
  });
}
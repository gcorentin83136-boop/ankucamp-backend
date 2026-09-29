import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  emailPrefsSchema,
  pushPrefsSchema,
  allNotificationsSchema,
} from "./notifications.validation";
import {
  getNotifications,
  updateAllNotifications,
  updateEmailPrefs,
  updatePushPrefs,
} from "./notifications.service";

// ============================================================
// GET /settings/notifications
// ============================================================

export async function get(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const notifications = await getNotifications(req.user.id);

  return res.json({ success: true, notifications });
}

// ============================================================
// PUT /settings/notifications
// ============================================================

export async function updateAll(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = allNotificationsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const notifications = await updateAllNotifications(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Préférences de notification mises à jour",
    notifications,
  });
}

// ============================================================
// PUT /settings/notifications/email
// ============================================================

export async function updateEmail(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = emailPrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const notifications = await updateEmailPrefs(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Préférences email mises à jour",
    notifications,
  });
}

// ============================================================
// PUT /settings/notifications/push
// ============================================================

export async function updatePush(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = pushPrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const notifications = await updatePushPrefs(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Préférences push mises à jour",
    notifications,
  });
}
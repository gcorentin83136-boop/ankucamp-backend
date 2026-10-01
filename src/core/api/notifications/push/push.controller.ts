import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  subscribePushSchema,
  unsubscribePushSchema,
} from "./push.validation";
import {
  subscribePush,
  unsubscribePush,
  getMySubscriptions,
} from "./push.service";

// ============================================================
// POST /notifications/push/subscribe
// ============================================================

export async function subscribe(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = subscribePushSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const subscription = await subscribePush(req.user.id, parsed.data);

  return res.status(201).json({
    success: true,
    message: "Token FCM enregistré",
    subscription: {
      id: subscription.id,
      platform: subscription.platform,
      device_info: subscription.device_info,
    },
  });
}

// ============================================================
// DELETE /notifications/push/unsubscribe
// ============================================================

export async function unsubscribe(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = unsubscribePushSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  await unsubscribePush(req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Token FCM supprimé",
  });
}

// ============================================================
// GET /notifications/push/subscriptions
// ============================================================

export async function listMine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const list = await getMySubscriptions(req.user.id);

  return res.json({
    success: true,
    count: list.length,
    subscriptions: list,
  });
}
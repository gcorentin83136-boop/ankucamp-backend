import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { grantBadgeSchema } from "../kyc/kyc.validation";
import { getUserBadges, grantBadge, revokeBadge } from "./badges.service";
import { logAdminActionAsync } from "../audit/audit.helper";

export async function getBadges(req: AuthRequest, res: Response) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) throw new AppError("ID invalide", 400);

  const badges = await getUserBadges(userId);
  return res.json({ success: true, badges });
}

export async function adminGrantBadge(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) throw new AppError("ID invalide", 400);

  const parsed = grantBadgeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Donnees invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await grantBadge(userId, parsed.data.badge, req.user.id);

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "badge_grant",
    targetType: "badge",
    targetId: userId,
    description: `Badge "${parsed.data.badge}" attribué à user #${userId}`,
    metadata: { user_id: userId, badge: parsed.data.badge },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.status(201).json({ success: true, badge: result });
}

export async function adminRevokeBadge(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) throw new AppError("ID invalide", 400);

  const parsed = grantBadgeSchema.safeParse({ badge: req.params.badge });
  if (!parsed.success) throw new AppError("Badge inconnu", 400);

  const result = await revokeBadge(userId, parsed.data.badge, req.user.id);

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "badge_revoke",
    targetType: "badge",
    targetId: userId,
    description: `Badge "${parsed.data.badge}" révoqué pour user #${userId}`,
    metadata: { user_id: userId, badge: parsed.data.badge },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json(result);
}
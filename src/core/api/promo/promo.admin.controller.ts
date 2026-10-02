import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createPromoSchema,
  updatePromoSchema,
  listPromosQuerySchema,
} from "./promo.validation";
import {
  listAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from "./promo.service";
import { logAdminActionAsync } from "../audit/audit.helper";

export async function list(req: AuthRequest, res: Response) {
  const parsed = listPromosQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const promos = await listAllPromoCodes(parsed.data);
  return res.json({ success: true, count: promos.length, promos });
}

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createPromoSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const promo = await createPromoCode(req.user.id, parsed.data);

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "promo_create",
    targetType: "promo",
    targetId: promo.id,
    description: `Code promo "${promo.code}" créé (${promo.type} ${promo.value})`,
    metadata: {
      code: promo.code,
      type: promo.type,
      value: promo.value,
    },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.status(201).json({ success: true, promo });
}

export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = updatePromoSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const promo = await updatePromoCode(id, parsed.data, req.user.id);

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "promo_update",
    targetType: "promo",
    targetId: id,
    description: `Code promo #${id} modifié`,
    metadata: { updates: parsed.data },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json({ success: true, promo });
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  await deletePromoCode(id);

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "promo_delete",
    targetType: "promo",
    targetId: id,
    description: `Code promo #${id} supprimé`,
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.status(204).send();
}
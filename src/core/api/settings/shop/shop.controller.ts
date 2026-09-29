import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import {
  vacationSchema,
  hiddenSchema,
  returnsSchema,
  contactSchema,
  shopSettingsSchema,
} from "./shop.validation";
import {
  getShopSettings,
  updateShopSettings,
  updateVacationMode,
  updateHiddenStatus,
  updateReturns,
  updateContact,
} from "./shop.service";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID boutique invalide", 400);
  return id;
}

// ============================================================
// GET /settings/shop/:shopId
// ============================================================

export async function get(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);
  const settings = await getShopSettings(shopId, req.user.id);

  return res.json({ success: true, settings });
}

// ============================================================
// PUT /settings/shop/:shopId
// ============================================================

export async function updateAll(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);

  const parsed = shopSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const settings = await updateShopSettings(shopId, req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Paramètres de la boutique mis à jour",
    settings,
  });
}

// ============================================================
// PUT /settings/shop/:shopId/vacation
// ============================================================

export async function putVacation(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);

  const parsed = vacationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const settings = await updateVacationMode(shopId, req.user.id, parsed.data);

  return res.json({
    success: true,
    message: parsed.data.vacation_mode
      ? "Boutique en mode vacances"
      : "Boutique en activité normale",
    settings,
  });
}

// ============================================================
// PUT /settings/shop/:shopId/hidden
// ============================================================

export async function putHidden(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);

  const parsed = hiddenSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const settings = await updateHiddenStatus(shopId, req.user.id, parsed.data);

  return res.json({
    success: true,
    message: parsed.data.is_hidden
      ? "Boutique masquée (invisible aux clients)"
      : "Boutique visible",
    settings,
  });
}

// ============================================================
// PUT /settings/shop/:shopId/returns
// ============================================================

export async function putReturns(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);

  const parsed = returnsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const settings = await updateReturns(shopId, req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Paramètres de retour mis à jour",
    settings,
  });
}

// ============================================================
// PUT /settings/shop/:shopId/contact
// ============================================================

export async function putContact(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);

  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const settings = await updateContact(shopId, req.user.id, parsed.data);

  return res.json({
    success: true,
    message: "Contact mis à jour",
    settings,
  });
}
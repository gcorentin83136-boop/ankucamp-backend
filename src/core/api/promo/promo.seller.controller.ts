import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createPromoSchema,
  updatePromoSchema,
  listPromosQuerySchema,
} from "./promo.validation";
import {
  listSellerPromoCodes,
  createSellerPromoCode,
  updateSellerPromoCode,
  deleteSellerPromoCode,
} from "./promo.service";

export async function listMine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listPromosQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const promos = await listSellerPromoCodes(req.user.id, parsed.data);
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

  const promo = await createSellerPromoCode(req.user.id, parsed.data);
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

  const promo = await updateSellerPromoCode(id, req.user.id, parsed.data);
  return res.json({ success: true, promo });
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  await deleteSellerPromoCode(id, req.user.id);
  return res.status(204).send();
}
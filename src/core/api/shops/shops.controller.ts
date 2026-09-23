import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createShopSchema, updateShopSchema } from "./shops.validation";
import {
  getAllShops,
  getShopById,
  getShopsByOwner,
  createShop,
  updateShop,
  deleteShop,
} from "./shops.service";

export async function listShops(_req: Request, res: Response) {
  const list = await getAllShops();
  return res.json({ success: true, shops: list });
}

export async function getOneShop(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const shop = await getShopById(id);
  if (!shop) {
    throw new AppError("Boutique introuvable", 404);
  }

  return res.json({ success: true, shop });
}

export async function listMyShops(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const list = await getShopsByOwner(req.user.id);
  return res.json({ success: true, shops: list });
}

export async function createOneShop(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const parsed = createShopSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const shop = await createShop(req.user.id, parsed.data);

  return res.status(201).json({
    success: true,
    message: "Boutique créée",
    shop,
  });
}

export async function updateOneShop(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const parsed = updateShopSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const shop = await updateShop(id, req.user.id, parsed.data);

  return res.json({ success: true, message: "Boutique mise à jour", shop });
}

export async function deleteOneShop(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  await deleteShop(id, req.user.id);
  return res.status(204).send();
}
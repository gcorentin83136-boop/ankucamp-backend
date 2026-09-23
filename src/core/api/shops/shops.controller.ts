import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
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
    return res.status(400).json({ success: false, message: "ID invalide" });
  }

  const shop = await getShopById(id);
  if (!shop) {
    return res.status(404).json({ success: false, message: "Boutique introuvable" });
  }

  return res.json({ success: true, shop });
}

export async function listMyShops(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const list = await getShopsByOwner(req.user.id);
  return res.json({ success: true, shops: list });
}

export async function createOneShop(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const parsed = createShopSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const shop = await createShop(req.user.id, parsed.data);
    return res.status(201).json({
      success: true,
      message: "Boutique créée",
      shop,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return res.status(400).json({ success: false, message });
  }
}

export async function updateOneShop(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID invalide" });
  }

  const parsed = updateShopSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const shop = await updateShop(id, req.user.id, parsed.data);
    return res.json({ success: true, message: "Boutique mise à jour", shop });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    // 403 si c'est un problème de propriété, 400 sinon
    const status = message.includes("propriétaire") ? 403 : 400;
    return res.status(status).json({ success: false, message });
  }
}

export async function deleteOneShop(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID invalide" });
  }

  try {
    await deleteShop(id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("propriétaire") ? 403 : 404;
    return res.status(status).json({ success: false, message });
  }
}
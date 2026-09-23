import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
  createProductSchema,
  updateProductSchema,
} from "./products.validation";
import {
  getAllProducts,
  getProductsByShop,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./products.service";

export async function listProducts(_req: Request, res: Response) {
  const list = await getAllProducts();
  return res.json({ success: true, products: list });
}

export async function listByShop(req: Request, res: Response) {
  const shopId = Number(req.params.shopId);
  if (isNaN(shopId)) {
    return res.status(400).json({ success: false, message: "shopId invalide" });
  }
  const list = await getProductsByShop(shopId);
  return res.json({ success: true, products: list });
}

export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID invalide" });
  }
  const product = await getProductById(id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produit introuvable" });
  }
  return res.json({ success: true, product });
}

export async function createOne(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const product = await createProduct(req.user.id, parsed.data);
    return res.status(201).json({
      success: true,
      message: "Produit créé",
      product,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("propriétaire") ? 403 : 400;
    return res.status(status).json({ success: false, message });
  }
}

export async function updateOne(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID invalide" });
  }

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Données invalides",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const product = await updateProduct(id, req.user.id, parsed.data);
    return res.json({ success: true, message: "Produit mis à jour", product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("propriétaire") ? 403 : 404;
    return res.status(status).json({ success: false, message });
  }
}

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: "ID invalide" });
  }

  try {
    await deleteProduct(id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("propriétaire") ? 403 : 404;
    return res.status(status).json({ success: false, message });
  }
}
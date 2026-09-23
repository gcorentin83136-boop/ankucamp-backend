import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
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
    throw new AppError("shopId invalide", 400);
  }

  const list = await getProductsByShop(shopId);
  return res.json({ success: true, products: list });
}

export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const product = await getProductById(id);
  if (!product) {
    throw new AppError("Produit introuvable", 404);
  }

  return res.json({ success: true, product });
}

export async function createOne(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const product = await createProduct(req.user.id, parsed.data);

  return res.status(201).json({
    success: true,
    message: "Produit créé",
    product,
  });
}

export async function updateOne(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const product = await updateProduct(id, req.user.id, parsed.data);

  return res.json({ success: true, message: "Produit mis à jour", product });
}

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError("Non authentifié", 401);
  }

  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new AppError("ID invalide", 400);
  }

  await deleteProduct(id, req.user.id);
  return res.status(204).send();
}
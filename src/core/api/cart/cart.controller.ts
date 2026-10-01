import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  addToCartSchema,
  updateCartItemSchema,
  cartCheckoutSchema,
} from "./cart.validation";
import {
  getMyCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  checkoutCart,
} from "./cart.service";

export async function getCart(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const cart = await getMyCart(req.user.id);
  return res.json({ success: true, ...cart });
}

export async function add(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = addToCartSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const cart = await addToCart(req.user.id, parsed.data);
  return res.status(201).json({ success: true, ...cart });
}

export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId)) throw new AppError("ID invalide", 400);

  const parsed = updateCartItemSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const cart = await updateCartItem(req.user.id, productId, parsed.data);
  return res.json({ success: true, ...cart });
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId)) throw new AppError("ID invalide", 400);

  const cart = await removeFromCart(req.user.id, productId);
  return res.json({ success: true, ...cart });
}

export async function clear(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await clearCart(req.user.id);
  return res.json(result);
}

export async function checkout(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = cartCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await checkoutCart(req.user.id, parsed.data);
  return res.status(201).json(result);
}
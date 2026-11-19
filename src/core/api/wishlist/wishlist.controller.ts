import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { listWishlistQuerySchema } from "./wishlist.validation";
import {
  toggleWishlist,
  listMyWishlist,
  isInWishlist,
  getMyWishlistCount,
  getMyWishlistProductIds,
} from "./wishlist.service";

function parseProductId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID produit invalide", 400);
  return id;
}

export async function toggle(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const productId = parseProductId(req.params.productId);
  const result = await toggleWishlist(productId, req.user.id);

  return res.json({
    success: true,
    message: result.in_wishlist
      ? "Ajouté aux favoris"
      : "Retiré des favoris",
    in_wishlist: result.in_wishlist,
  });
}

export async function mine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listWishlistQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const list = await listMyWishlist(req.user.id, parsed.data);
  return res.json({ success: true, count: list.length, items: list });
}

export async function count(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const c = await getMyWishlistCount(req.user.id);
  return res.json({ success: true, count: c });
}

export async function check(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const productId = parseProductId(req.params.productId);
  const in_wishlist = await isInWishlist(productId, req.user.id);

  return res.json({ success: true, in_wishlist });
}

export async function productIds(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const ids = await getMyWishlistProductIds(req.user.id);
  return res.json({ success: true, product_ids: ids });
}
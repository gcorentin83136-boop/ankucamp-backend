import { Response } from "express";
import { eq } from "drizzle-orm";
import { cloudinary } from "../../../config/cloudinary";
import { db } from "../../db";
import { users, shops, products } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { AuthRequest } from "../../middlewares/auth.middleware";

/**
 * Upload un buffer vers Cloudinary.
 */
async function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1000, height: 1000, crop: "limit" },
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            new AppError(
              error?.message ?? "Échec de l'upload vers Cloudinary",
              500
            )
          );
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// ============================================================
// POST /uploads/avatar
// ============================================================
export async function uploadAvatar(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/avatars");

  await db
    .update(users)
    .set({ avatar_url: url })
    .where(eq(users.id, req.user.id));

  return res.status(200).json({
    success: true,
    message: "Avatar mis à jour",
    url,
  });
}

// ============================================================
// POST /uploads/shop-logo
// ============================================================
export async function uploadShopLogo(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const shopId = Number(req.body.shop_id);
  if (isNaN(shopId)) throw new AppError("shop_id requis dans le body", 400);

  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);
  if (shop.owner_id !== req.user.id) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/shops");

  await db.update(shops).set({ logo_url: url }).where(eq(shops.id, shopId));

  return res.status(200).json({
    success: true,
    message: "Logo mis à jour",
    url,
  });
}

// ============================================================
// POST /uploads/product
// ============================================================
export async function uploadProductImage(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const productId = Number(req.body.product_id);
  if (isNaN(productId)) {
    throw new AppError("product_id requis dans le body", 400);
  }

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new AppError("Produit introuvable", 404);

  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, product.shop_id))
    .limit(1);

  if (!shop || shop.owner_id !== req.user.id) {
    throw new AppError(
      "Vous n'êtes pas le propriétaire de la boutique parente",
      403
    );
  }

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/products");

  await db
    .update(products)
    .set({ image_url: url })
    .where(eq(products.id, productId));

  return res.status(200).json({
    success: true,
    message: "Image produit mise à jour",
    url,
  });
}
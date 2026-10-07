import { Response } from "express";
import { eq } from "drizzle-orm";
import { cloudinary } from "../../../config/cloudinary";
import { db } from "../../db";
import { users, shops, products } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { AuthRequest } from "../../middlewares/auth.middleware";

// ============================================================
// HELPER CLOUDINARY
// ============================================================

interface UploadOptions {
  width?: number;
  height?: number;
  crop?: string;
  resourceType?: "image" | "raw" | "auto" | "video";
  format?: string;
}

async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  options: UploadOptions = {}
): Promise<string> {
  const {
    width = 1000,
    height = 1000,
    crop = "limit",
    resourceType = "image",
  } = options;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation:
          resourceType === "image"
            ? [
                { width, height, crop },
                { quality: "auto:good" },
                { fetch_format: "auto" },
              ]
            : undefined,
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

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/avatars", {
    width: 500,
    height: 500,
  });

  await db
    .update(users)
    .set({ avatar_url: url })
    .where(eq(users.id, req.user.id));

  return res.status(200).json({ success: true, message: "Avatar mis à jour", url });
}

// ============================================================
// POST /uploads/cover
// ============================================================
export async function uploadCover(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/covers", {
    width: 2000,
    height: 600,
  });

  await db
    .update(users)
    .set({ cover_url: url })
    .where(eq(users.id, req.user.id));

  return res.status(200).json({ success: true, message: "Cover mise à jour", url });
}

// ============================================================
// POST /uploads/shop-logo
// ============================================================
export async function uploadShopLogo(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const shopId = Number(req.body.shop_id);
  if (isNaN(shopId)) throw new AppError("shop_id requis dans le body", 400);

  const [shop] = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1);
  if (!shop) throw new AppError("Boutique introuvable", 404);
  if (shop.owner_id !== req.user.id) throw new AppError("Non propriétaire", 403);

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/shops", {
    width: 500,
    height: 500,
  });

  await db.update(shops).set({ logo_url: url }).where(eq(shops.id, shopId));

  return res.status(200).json({ success: true, message: "Logo mis à jour", url });
}

// ============================================================
// POST /uploads/product
// ============================================================
export async function uploadProductImage(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const productId = Number(req.body.product_id);
  if (isNaN(productId)) throw new AppError("product_id requis dans le body", 400);

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
  if (!shop || shop.owner_id !== req.user.id) throw new AppError("Non propriétaire", 403);

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/products", {
    width: 1200,
    height: 1200,
  });

  await db.update(products).set({ image_url: url }).where(eq(products.id, productId));

  return res.status(200).json({ success: true, message: "Image produit mise à jour", url });
}

// ============================================================
// POST /uploads/post-media
// ============================================================
export async function uploadPostMedia(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const url = await uploadToCloudinary(req.file.buffer, "ankucamp/posts", {
    width: 1200,
    height: 1200,
  });

  return res.status(200).json({ success: true, message: "Média uploadé", url });
}

// ============================================================
// POST /uploads/kyc-document  ⭐ NOUVEAU
// Upload un document KYC (PDF ou image) et retourne l'URL.
// ============================================================
export async function uploadKycDocument(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  // Cloudinary : resourceType "auto" pour gérer PDF + images
  const url = await uploadToCloudinary(
    req.file.buffer,
    "ankucamp/kyc-documents",
    { resourceType: "auto" }
  );

  return res.status(200).json({
    success: true,
    message: "Document uploadé",
    url,
  });
}

// ============================================================
// POST /uploads/product-image-draft
// Upload une image SANS product_id (avant creation du produit).
// Retourne juste l'URL Cloudinary.
// ============================================================
export async function uploadProductImageDraft(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const url = await uploadToCloudinary(
    req.file.buffer,
    "ankucamp/products",
    {
      width: 1200,
      height: 1200,
    }
  );

  return res.status(200).json({
    success: true,
    message: "Image uploadee",
    url,
  });
}

// ============================================================
// POST /uploads/product-video
// Upload une video produit (max 3 par produit).
// Body : multipart avec file + product_id
// Append l'URL au tableau video_urls du produit.
// ============================================================
export async function uploadProductVideo(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifie", 401);
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
    throw new AppError("Non proprietaire", 403);
  }

  // Parse video_urls existant
  let videos: string[] = [];
  if (product.video_urls) {
    try {
      videos = JSON.parse(product.video_urls);
      if (!Array.isArray(videos)) videos = [];
    } catch {
      videos = [];
    }
  }

  // Limite de 3 videos
  if (videos.length >= 3) {
    throw new AppError(
      "Maximum 3 videos par produit. Supprime-en une avant d'en ajouter une nouvelle.",
      400
    );
  }

  // Upload Cloudinary avec resource_type "video"
  const url = await uploadToCloudinary(
    req.file.buffer,
    "ankucamp/products/videos",
    {
      resourceType: "video",
    }
  );

  videos.push(url);

  await db
    .update(products)
    .set({ video_urls: JSON.stringify(videos) })
    .where(eq(products.id, productId));

  return res.status(200).json({
    success: true,
    message: "Video ajoutee",
    url,
    video_urls: videos,
  });
}

// ============================================================
// DELETE /uploads/product-video
// Body JSON : { product_id, url }
// Retire une video du tableau video_urls.
// ============================================================
export async function deleteProductVideo(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifie", 401);

  const { product_id, url } = req.body as {
    product_id?: number;
    url?: string;
  };

  if (!product_id || !url) {
    throw new AppError("product_id et url requis", 400);
  }

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, product_id))
    .limit(1);
  if (!product) throw new AppError("Produit introuvable", 404);

  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, product.shop_id))
    .limit(1);
  if (!shop || shop.owner_id !== req.user.id) {
    throw new AppError("Non proprietaire", 403);
  }

  let videos: string[] = [];
  if (product.video_urls) {
    try {
      videos = JSON.parse(product.video_urls);
      if (!Array.isArray(videos)) videos = [];
    } catch {
      videos = [];
    }
  }

  videos = videos.filter((v) => v !== url);

  await db
    .update(products)
    .set({ video_urls: videos.length > 0 ? JSON.stringify(videos) : null })
    .where(eq(products.id, product_id));

  return res.status(200).json({
    success: true,
    message: "Video supprimee",
    video_urls: videos,
  });
}
// ============================================================
// POST /uploads/product-video-draft
// Upload une video SANS product_id (avant creation du produit).
// ============================================================
export async function uploadProductVideoDraft(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const url = await uploadToCloudinary(
    req.file.buffer,
    "ankucamp/products/videos",
    {
      resourceType: "video",
    }
  );

  return res.status(200).json({
    success: true,
    message: "Video uploadee",
    url,
  });
}


// ============================================================
// POST /uploads/event-cover
// Upload une image de couverture d'événement
// ============================================================
export async function uploadEventCover(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  if (!req.file) throw new AppError("Aucun fichier fourni", 400);

  const url = await uploadToCloudinary(
    req.file.buffer,
    "ankucamp/events/covers",
    {
      resourceType: "image",
    }
  );

  return res.status(200).json({
    success: true,
    message: "Image uploadée",
    url,
  });
}
import { eq, notInArray, inArray } from "drizzle-orm";
import { db } from "../../db";
import { products, shops, shopSettings, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getBadgesForUsers, getUserBadges } from "../badges/badges.service";
import {
  getBulkSellerRatings,
  getSellerGlobalRating,
} from "../reviews/reviews.service";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "./products.validation";

// ============================================================
// HELPERS
// ============================================================

async function assertShopOwner(shopId: number, userId: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);
  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'etes pas le proprietaire de cette boutique", 403);
  }

  return shop;
}

async function assertProductOwnership(productId: number, userId: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new AppError("Produit introuvable", 404);

  await assertShopOwner(product.shop_id, userId);
  return product;
}

async function getHiddenShopIds(): Promise<number[]> {
  const rows = await db
    .select({ shop_id: shopSettings.shop_id })
    .from(shopSettings)
    .where(eq(shopSettings.is_hidden, 1));

  return rows.map((r) => r.shop_id);
}

export async function enrichProduct(
  product: any,
  shopMap?: Map<number, any>,
  badgesMap?: Map<number, string[]>,
  ratingsMap?: Map<number, { average: number; count: number }>
) {
  let shop: any = null;

  if (shopMap) {
    shop = shopMap.get(product.shop_id) ?? null;
  } else {
    const [found] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, product.shop_id))
      .limit(1);
    shop = found ?? null;
  }

  if (!shop) {
    return { ...product, shop: null };
  }

  const [owner] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
      verification_status: users.verification_status,
    })
    .from(users)
    .where(eq(users.id, shop.owner_id))
    .limit(1);

  if (!owner) {
    return { ...product, shop: { ...shop, owner: null } };
  }

  const badges = badgesMap
    ? badgesMap.get(owner.id) ?? []
    : await getUserBadges(owner.id);

  const rating = ratingsMap
    ? ratingsMap.get(owner.id) ?? { average: 0, count: 0 }
    : await getSellerGlobalRating(owner.id);

  return {
    ...product,
    shop: { ...shop, owner: { ...owner, badges, rating } },
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function getAllProducts() {
  const hiddenIds = await getHiddenShopIds();

  const rows =
    hiddenIds.length === 0
      ? await db.select().from(products)
      : await db
          .select()
          .from(products)
          .where(notInArray(products.shop_id, hiddenIds));

  const shopIds = Array.from(new Set(rows.map((r) => r.shop_id)));
  const shopRows =
    shopIds.length > 0
      ? await db.select().from(shops).where(inArray(shops.id, shopIds))
      : [];

  const shopMap = new Map<number, any>();
  for (const s of shopRows) shopMap.set(s.id, s);

  const ownerIds = shopRows.map((s) => s.owner_id);
  const badgesMap = await getBadgesForUsers(ownerIds);
  const ratingsMap = await getBulkSellerRatings(ownerIds);

  return Promise.all(
    rows.map((r) => enrichProduct(r, shopMap, badgesMap, ratingsMap))
  );
}

export async function getProductsByShop(shopId: number) {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.shop_id, shopId));

  return Promise.all(rows.map((r) => enrichProduct(r)));
}

export async function getProductById(id: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) return null;
  return enrichProduct(product);
}

// ============================================================
// CRUD
// ============================================================

export async function createProduct(
  userId: number,
  input: CreateProductInput
) {
  await assertShopOwner(input.shop_id, userId);

  const [created] = await db
    .insert(products)
    .values({
      shop_id: input.shop_id,
      name: input.name,
      description: input.description ?? null,
      image_url: input.image_url || null,
      video_urls:
        input.video_urls && input.video_urls.length > 0
          ? JSON.stringify(input.video_urls)
          : null,
      location: input.location ?? null,
      stock: input.has_unlimited_stock ? 0 : input.stock ?? 0,
      has_unlimited_stock: input.has_unlimited_stock ? 1 : 0,
      price: String(input.price),
      delivery_pickup: input.delivery_pickup === false ? 0 : 1,
      delivery_shipping: input.delivery_shipping ? 1 : 0,
      delivery_meeting: input.delivery_meeting ? 1 : 0,
      meeting_point_address: input.meeting_point_address ?? null,
      meeting_point_instructions: input.meeting_point_instructions ?? null,
    })
    .returning();

  return created;
}

export async function updateProduct(
  productId: number,
  userId: number,
  input: UpdateProductInput
) {
  await assertProductOwnership(productId, userId);

  const dataToUpdate: Record<string, unknown> = {};

  if (input.name !== undefined) dataToUpdate.name = input.name;
  if (input.description !== undefined)
    dataToUpdate.description = input.description;
  if (input.image_url !== undefined) dataToUpdate.image_url = input.image_url;
  if (input.location !== undefined) dataToUpdate.location = input.location;
  if (input.meeting_point_address !== undefined)
    dataToUpdate.meeting_point_address = input.meeting_point_address;
  if (input.meeting_point_instructions !== undefined)
    dataToUpdate.meeting_point_instructions = input.meeting_point_instructions;

  if (typeof input.price === "number") {
    dataToUpdate.price = String(input.price);
  }

  if (input.video_urls !== undefined) {
    dataToUpdate.video_urls =
      input.video_urls.length > 0 ? JSON.stringify(input.video_urls) : null;
  }

  if (input.has_unlimited_stock !== undefined) {
    dataToUpdate.has_unlimited_stock = input.has_unlimited_stock ? 1 : 0;
    if (input.has_unlimited_stock) {
      dataToUpdate.stock = 0;
    } else if (typeof input.stock === "number") {
      dataToUpdate.stock = input.stock;
    }
  } else if (typeof input.stock === "number") {
    dataToUpdate.stock = input.stock;
  }

  if (input.delivery_pickup !== undefined) {
    dataToUpdate.delivery_pickup = input.delivery_pickup ? 1 : 0;
  }
  if (input.delivery_shipping !== undefined) {
    dataToUpdate.delivery_shipping = input.delivery_shipping ? 1 : 0;
  }
  if (input.delivery_meeting !== undefined) {
    dataToUpdate.delivery_meeting = input.delivery_meeting ? 1 : 0;
  }

  const [updated] = await db
    .update(products)
    .set(dataToUpdate)
    .where(eq(products.id, productId))
    .returning();

  return updated;
}

export async function deleteProduct(productId: number, userId: number) {
  await assertProductOwnership(productId, userId);
  await db.delete(products).where(eq(products.id, productId));
}

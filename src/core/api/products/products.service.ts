import { eq } from "drizzle-orm";
import { db } from "../../db";
import { products, shops } from "../../db/schema";
import { AppError } from "../../errors/AppError";
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

  if (!shop) {
    throw new AppError("Boutique introuvable", 404);
  }

  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  return shop;
}

async function assertProductOwnership(productId: number, userId: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new AppError("Produit introuvable", 404);
  }

  await assertShopOwner(product.shop_id, userId);

  return product;
}

// ============================================================
// CRUD
// ============================================================

export async function getAllProducts() {
  return db.select().from(products);
}

export async function getProductsByShop(shopId: number) {
  return db.select().from(products).where(eq(products.shop_id, shopId));
}

export async function getProductById(id: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return product ?? null;
}

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
      location: input.location ?? null,
      stock: input.stock ?? 0,
      price: String(input.price),
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

  const dataToUpdate: Record<string, unknown> = { ...input };
  if (typeof input.price === "number") {
    dataToUpdate.price = String(input.price);
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
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { products, shops } from "../../db/schema";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "./products.validation";

// ============================================================
// HELPERS
// ============================================================

/**
 * Vérifie que l'utilisateur est bien le propriétaire de la boutique.
 * @throws Error si la boutique n'existe pas ou si ce n'est pas le propriétaire.
 */
async function assertShopOwner(shopId: number, userId: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) {
    throw new Error("Boutique introuvable");
  }

  if (shop.owner_id !== userId) {
    throw new Error("Vous n'êtes pas le propriétaire de cette boutique");
  }

  return shop;
}

/**
 * Vérifie que l'utilisateur est propriétaire de la boutique parente du produit.
 * @throws Error si le produit n'existe pas ou si l'utilisateur n'est pas le propriétaire.
 */
async function assertProductOwnership(productId: number, userId: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new Error("Produit introuvable");
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
  // 1. Vérifier que l'utilisateur possède bien la boutique cible
  await assertShopOwner(input.shop_id, userId);

  // 2. Insérer (attention : decimal attend une STRING côté Drizzle)
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

  // Convertir price en string si présent
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
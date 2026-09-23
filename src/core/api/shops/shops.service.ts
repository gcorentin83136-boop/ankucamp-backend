import { eq } from "drizzle-orm";
import { db } from "../../db";
import { shops } from "../../db/schema";
import type { CreateShopInput, UpdateShopInput } from "./shops.validation";

export async function getAllShops() {
  return db.select().from(shops);
}

export async function getShopById(id: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, id))
    .limit(1);

  return shop ?? null;
}

export async function getShopsByOwner(ownerId: number) {
  return db.select().from(shops).where(eq(shops.owner_id, ownerId));
}

export async function createShop(ownerId: number, input: CreateShopInput) {
  const [created] = await db
    .insert(shops)
    .values({
      owner_id: ownerId,
      name: input.name,
      description: input.description ?? null,
      logo_url: input.logo_url || null,
      banner_url: input.banner_url || null,
      address: input.address ?? null,
      city: input.city ?? null,
      postal_code: input.postal_code ?? null,
      phone: input.phone ?? null,
    })
    .returning();

  return created;
}

/**
 * Met à jour une boutique. Vérifie que l'appelant est bien le propriétaire.
 * @throws Error si la boutique n'existe pas ou si l'appelant n'est pas le propriétaire.
 */
export async function updateShop(
  shopId: number,
  userId: number,
  input: UpdateShopInput
) {
  const shop = await getShopById(shopId);

  if (!shop) {
    throw new Error("Boutique introuvable");
  }

  if (shop.owner_id !== userId) {
    throw new Error("Vous n'êtes pas le propriétaire de cette boutique");
  }

  const [updated] = await db
    .update(shops)
    .set(input)
    .where(eq(shops.id, shopId))
    .returning();

  return updated;
}

/**
 * Supprime une boutique. Vérifie la propriété.
 */
export async function deleteShop(shopId: number, userId: number) {
  const shop = await getShopById(shopId);

  if (!shop) {
    throw new Error("Boutique introuvable");
  }

  if (shop.owner_id !== userId) {
    throw new Error("Vous n'êtes pas le propriétaire de cette boutique");
  }

  await db.delete(shops).where(eq(shops.id, shopId));
}
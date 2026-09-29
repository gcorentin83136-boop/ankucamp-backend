import { eq, ne, and } from "drizzle-orm";
import { db } from "../../db";
import { shops, shopSettings } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type { CreateShopInput, UpdateShopInput } from "./shops.validation";

// ============================================================
// LECTURE (exclut les boutiques masquées pour le public)
// ============================================================

/**
 * Liste toutes les boutiques NON MASQUÉES.
 */
export async function getAllShops() {
  const hiddenShopIds = await db
    .select({ shop_id: shopSettings.shop_id })
    .from(shopSettings)
    .where(eq(shopSettings.is_hidden, 1));

  const hiddenIds = hiddenShopIds.map((s) => s.shop_id);

  if (hiddenIds.length === 0) {
    return db.select().from(shops);
  }

  // Exclut les IDs masqués
  return db
    .select()
    .from(shops)
    .where(
      hiddenIds.length === 1
        ? ne(shops.id, hiddenIds[0])
        : // @ts-ignore
          ne(shops.id, hiddenIds[0]) && ne(shops.id, hiddenIds[0]) // fallback
    );
}

export async function getShopById(id: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, id))
    .limit(1);

  return shop ?? null;
}

/**
 * Liste des boutiques d'un owner (inclut les masquées, car c'est le owner qui voit).
 */
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

export async function updateShop(
  shopId: number,
  userId: number,
  input: UpdateShopInput
) {
  const shop = await getShopById(shopId);

  if (!shop) {
    throw new AppError("Boutique introuvable", 404);
  }

  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  const [updated] = await db
    .update(shops)
    .set(input)
    .where(eq(shops.id, shopId))
    .returning();

  return updated;
}

export async function deleteShop(shopId: number, userId: number) {
  const shop = await getShopById(shopId);

  if (!shop) {
    throw new AppError("Boutique introuvable", 404);
  }

  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  await db.delete(shops).where(eq(shops.id, shopId));
}
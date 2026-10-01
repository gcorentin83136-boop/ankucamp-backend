import { eq, notInArray } from "drizzle-orm";
import { db } from "../../db";
import { shops, shopSettings, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getBadgesForUsers, getUserBadges } from "../badges/badges.service";
import type { CreateShopInput, UpdateShopInput } from "./shops.validation";

// ============================================================
// HELPERS
// ============================================================

async function getHiddenShopIds(): Promise<number[]> {
  const rows = await db
    .select({ shop_id: shopSettings.shop_id })
    .from(shopSettings)
    .where(eq(shopSettings.is_hidden, 1));
  return rows.map((r) => r.shop_id);
}

/**
 * Enrichit un shop avec les infos de l'owner + ses badges.
 * `badgesMap` optionnel (batch anti N+1).
 */
async function enrichShop(shop: any, badgesMap?: Map<number, string[]>) {
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
    return { ...shop, owner: null };
  }

  const badges = badgesMap
    ? badgesMap.get(owner.id) ?? []
    : await getUserBadges(owner.id);

  return { ...shop, owner: { ...owner, badges } };
}

// ============================================================
// LECTURE
// ============================================================

/**
 * Liste toutes les boutiques NON MASQUÉES (+ owner + badges).
 */
export async function getAllShops() {
  const hiddenIds = await getHiddenShopIds();

  const rows =
    hiddenIds.length === 0
      ? await db.select().from(shops)
      : await db
          .select()
          .from(shops)
          .where(notInArray(shops.id, hiddenIds));

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.owner_id));
  return Promise.all(rows.map((r) => enrichShop(r, badgesMap)));
}

export async function getShopById(id: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, id))
    .limit(1);

  if (!shop) return null;
  return enrichShop(shop);
}

/**
 * Liste des boutiques d'un owner (sans enrichissement : c'est lui-même).
 */
export async function getShopsByOwner(ownerId: number) {
  return db.select().from(shops).where(eq(shops.owner_id, ownerId));
}

// ============================================================
// ÉCRITURE
// ============================================================

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
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);
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
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);
  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  await db.delete(shops).where(eq(shops.id, shopId));
}
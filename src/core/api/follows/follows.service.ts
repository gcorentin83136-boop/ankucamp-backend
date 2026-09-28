import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { follows, shops } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type { ListFollowsQuery } from "./follows.validation";

// ============================================================
// SUIVRE / NE PLUS SUIVRE
// ============================================================

export async function toggleFollow(shopId: number, userId: number) {
  // Vérifie que la boutique existe
  const [shop] = await db
    .select({ id: shops.id, owner_id: shops.owner_id })
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);

  // On ne peut pas suivre sa propre boutique
  if (shop.owner_id === userId) {
    throw new AppError("Tu ne peux pas suivre ta propre boutique", 400);
  }

  const [existing] = await db
    .select()
    .from(follows)
    .where(and(eq(follows.shop_id, shopId), eq(follows.follower_id, userId)))
    .limit(1);

  if (existing) {
    await db.delete(follows).where(eq(follows.id, existing.id));
    return { following: false };
  }

  await db.insert(follows).values({ shop_id: shopId, follower_id: userId });

  return { following: true };
}

// ============================================================
// LECTURE
// ============================================================

export async function isFollowing(shopId: number, userId: number) {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.shop_id, shopId), eq(follows.follower_id, userId)))
    .limit(1);

  return !!row;
}

/**
 * Liste des boutiques suivies par un user.
 */
export async function listMyFollows(
  userId: number,
  query: ListFollowsQuery
) {
  const { limit, offset } = query;

  const rows = await db
    .select({
      id: follows.id,
      shop_id: follows.shop_id,
      created_at: follows.created_at,
      shop_name: shops.name,
      shop_logo_url: shops.logo_url,
      shop_city: shops.city,
      shop_owner_id: shops.owner_id,
    })
    .from(follows)
    .leftJoin(shops, eq(shops.id, follows.shop_id))
    .where(eq(follows.follower_id, userId))
    .orderBy(desc(follows.created_at))
    .limit(limit)
    .offset(offset);

  return rows;
}

/**
 * Liste des abonnés d'une boutique.
 */
export async function listShopFollowers(
  shopId: number,
  query: ListFollowsQuery
) {
  const { limit, offset } = query;

  const rows = await db
    .select({
      id: follows.id,
      follower_id: follows.follower_id,
      created_at: follows.created_at,
    })
    .from(follows)
    .where(eq(follows.shop_id, shopId))
    .orderBy(desc(follows.created_at))
    .limit(limit)
    .offset(offset);

  return rows;
}

/**
 * Nombre de followers d'une boutique.
 */
export async function getShopFollowersCount(shopId: number) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.shop_id, shopId));

  return result?.count ?? 0;
}

/**
 * Nombre de boutiques suivies par un user.
 */
export async function getMyFollowsCount(userId: number) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.follower_id, userId));

  return result?.count ?? 0;
}
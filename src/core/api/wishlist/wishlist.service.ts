import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { wishlists, products } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { enrichProduct } from "../products/products.service";
import type { ListWishlistQuery } from "./wishlist.validation";

// ============================================================
// TOGGLE (ajoute / retire)
// ============================================================

export async function toggleWishlist(productId: number, userId: number) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new AppError("Produit introuvable", 404);

  const [existing] = await db
    .select()
    .from(wishlists)
    .where(
      and(eq(wishlists.product_id, productId), eq(wishlists.user_id, userId))
    )
    .limit(1);

  if (existing) {
    await db.delete(wishlists).where(eq(wishlists.id, existing.id));
    return { in_wishlist: false };
  }

  await db.insert(wishlists).values({ product_id: productId, user_id: userId });
  return { in_wishlist: true };
}

// ============================================================
// LECTURE
// ============================================================

export async function listMyWishlist(
  userId: number,
  query: ListWishlistQuery
) {
  const { limit, offset } = query;

  const rows = await db
    .select({
      wishlist_id: wishlists.id,
      added_at: wishlists.created_at,
      product_id: wishlists.product_id,
    })
    .from(wishlists)
    .where(eq(wishlists.user_id, userId))
    .orderBy(desc(wishlists.created_at))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.product_id);
  const productRows = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));

  const enriched = await Promise.all(
    productRows.map((p) => enrichProduct(p))
  );
  const byId = new Map(enriched.map((p) => [p.id, p]));

  return rows
    .map((r) => {
      const p = byId.get(r.product_id);
      if (!p) return null;
      return {
        ...p,
        wishlist_id: r.wishlist_id,
        added_at: r.added_at,
      };
    })
    .filter((x) => x !== null);
}

export async function isInWishlist(
  productId: number,
  userId: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(
      and(eq(wishlists.product_id, productId), eq(wishlists.user_id, userId))
    )
    .limit(1);
  return !!row;
}

export async function getMyWishlistCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wishlists)
    .where(eq(wishlists.user_id, userId));
  return row?.count ?? 0;
}

export async function getMyWishlistProductIds(
  userId: number
): Promise<number[]> {
  const rows = await db
    .select({ product_id: wishlists.product_id })
    .from(wishlists)
    .where(eq(wishlists.user_id, userId));
  return rows.map((r) => r.product_id);
}
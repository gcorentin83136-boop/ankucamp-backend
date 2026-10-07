import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  reviews,
  reviewReports,
  orders,
  orderItems,
  products,
  users,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { notifyNewReview } from "../../notifications/notifications.helper";
import { getBadgesForUsers, getUserBadges } from "../badges/badges.service";
import type {
  CreateReviewInput,
  ListReviewsQuery,
  UpdateReviewInput,
} from "./reviews.validation";

// ============================================================
// CRÉATION D'UN AVIS
// ============================================================

export async function createReview(
  authorId: number,
  input: CreateReviewInput
) {
  const { order_id, product_id, rating, comment } = input;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, order_id))
    .limit(1);

  if (!order) {
    throw new AppError("Commande introuvable", 404);
  }

  if (order.buyer_id !== authorId) {
    throw new AppError("Seul l'acheteur peut laisser un avis", 403);
  }

  if (order.status !== "delivered") {
    throw new AppError(
      "Tu peux laisser un avis uniquement après réception de la commande",
      400
    );
  }

  const [orderItem] = await db
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.order_id, order_id),
        eq(orderItems.product_id, product_id)
      )
    )
    .limit(1);

  if (!orderItem) {
    throw new AppError("Ce produit ne fait pas partie de cette commande", 400);
  }

  const [existingReview] = await db
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.order_id, order_id), eq(reviews.product_id, product_id))
    )
    .limit(1);

  if (existingReview) {
    throw new AppError("Tu as déjà laissé un avis sur ce produit", 400);
  }

  const [review] = await db
    .insert(reviews)
    .values({
      order_id,
      product_id,
      author_id: authorId,
      seller_id: order.seller_id,
      rating,
      comment: comment ?? null,
    })
    .returning();

  try {
    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, product_id))
      .limit(1);

    if (author && product) {
      await notifyNewReview(
        order.seller_id,
        review.id,
        rating,
        product.name,
        `${author.first_name} ${author.last_name}`
      );
    }
  } catch (err) {
    console.error("❌ Erreur notification nouvel avis:", err);
  }

  return review;
}

// ============================================================
// LECTURE — AVIS PAR PRODUIT
// ============================================================

export async function getReviewsByProduct(
  productId: number,
  query: ListReviewsQuery
) {
  const { limit, offset, sort } = query;

  const orderBy =
    sort === "rating_desc"
      ? desc(reviews.rating)
      : sort === "rating_asc"
      ? asc(reviews.rating)
      : desc(reviews.created_at);

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      created_at: reviews.created_at,
      author_id: reviews.author_id,
      author_first_name: users.first_name,
      author_last_name: users.last_name,
      author_username: users.username,
      author_avatar_url: users.avatar_url,
      author_verification_status: users.verification_status,
    })
    .from(reviews)
    .leftJoin(users, eq(users.id, reviews.author_id))
    .where(and(eq(reviews.product_id, productId), eq(reviews.is_flagged, 0)))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.author_id));

  return rows.map((r) => ({
    ...r,
    author_badges: badgesMap.get(r.author_id) ?? [],
  }));
}

// ============================================================
// LECTURE — AVIS PAR VENDEUR
// ============================================================

export async function getReviewsBySeller(
  sellerId: number,
  query: ListReviewsQuery
) {
  const { limit, offset, sort } = query;

  const orderBy =
    sort === "rating_desc"
      ? desc(reviews.rating)
      : sort === "rating_asc"
      ? asc(reviews.rating)
      : desc(reviews.created_at);

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      created_at: reviews.created_at,
      is_flagged: reviews.is_flagged,
      product_id: reviews.product_id,
      product_name: products.name,
      author_id: reviews.author_id,
      author_first_name: users.first_name,
      author_last_name: users.last_name,
      author_username: users.username,
      author_avatar_url: users.avatar_url,
      author_verification_status: users.verification_status,
    })
    .from(reviews)
    .leftJoin(products, eq(products.id, reviews.product_id))
    .leftJoin(users, eq(users.id, reviews.author_id))
    .where(eq(reviews.seller_id, sellerId))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.author_id));

  return rows.map((r) => ({
    ...r,
    author_badges: badgesMap.get(r.author_id) ?? [],
  }));
}

// ============================================================
// LECTURE — MES AVIS (auteur)
// ============================================================

export async function getMyReviews(authorId: number) {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      created_at: reviews.created_at,
      product_id: reviews.product_id,
      product_name: products.name,
      order_id: reviews.order_id,
    })
    .from(reviews)
    .leftJoin(products, eq(products.id, reviews.product_id))
    .where(eq(reviews.author_id, authorId))
    .orderBy(desc(reviews.created_at));

  return rows;
}

// ============================================================
// STATS — MOYENNE ET DISTRIBUTION
// ============================================================

export async function getProductRatingStats(productId: number) {
  const rows = await db
    .select({
      rating: reviews.rating,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.product_id, productId), eq(reviews.is_flagged, 0)))
    .groupBy(reviews.rating);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const weighted = rows.reduce((sum, r) => sum + r.rating * r.count, 0);
  const average = total > 0 ? weighted / total : 0;

  const distribution: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const r of rows) {
    distribution[r.rating] = r.count;
  }

  return {
    average: Number(average.toFixed(1)),
    total,
    distribution,
  };
}

// ============================================================
// STATS — POUR PLUSIEURS PRODUITS (bulk)
// ============================================================

export async function getBulkProductRatingStats(productIds: number[]) {
  if (productIds.length === 0) {
    return {} as Record<number, { average: number; total: number }>;
  }

  const rows = await db
    .select({
      product_id: reviews.product_id,
      rating: reviews.rating,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(inArray(reviews.product_id, productIds), eq(reviews.is_flagged, 0))
    )
    .groupBy(reviews.product_id, reviews.rating);

  const stats: Record<number, { average: number; total: number }> = {};

  for (const productId of productIds) {
    stats[productId] = { average: 0, total: 0 };
  }

  const temp: Record<number, { sum: number; count: number }> = {};
  for (const row of rows) {
    if (!temp[row.product_id]) {
      temp[row.product_id] = { sum: 0, count: 0 };
    }
    temp[row.product_id].sum += row.rating * row.count;
    temp[row.product_id].count += row.count;
  }

  for (const productId of productIds) {
    const t = temp[productId];
    if (t && t.count > 0) {
      stats[productId] = {
        average: Number((t.sum / t.count).toFixed(1)),
        total: t.count,
      };
    }
  }

  return stats;
}

// ============================================================
// SUPPRESSION D'UN AVIS
// ============================================================

export async function deleteReview(reviewId: number, userId: number) {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) {
    throw new AppError("Avis introuvable", 404);
  }

  if (review.author_id !== userId) {
    throw new AppError("Tu ne peux supprimer que tes propres avis", 403);
  }

  await db.delete(reviewReports).where(eq(reviewReports.review_id, reviewId));
  await db.delete(reviews).where(eq(reviews.id, reviewId));
}

// ============================================================
// SIGNALEMENT D'UN AVIS
// ============================================================

export async function reportReview(
  reviewId: number,
  reporterId: number,
  reason: string
) {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) {
    throw new AppError("Avis introuvable", 404);
  }

  if (review.seller_id !== reporterId) {
    throw new AppError("Seul le vendeur concerné peut signaler cet avis", 403);
  }

  const [existingReport] = await db
    .select()
    .from(reviewReports)
    .where(
      and(
        eq(reviewReports.review_id, reviewId),
        eq(reviewReports.reporter_id, reporterId)
      )
    )
    .limit(1);

  if (existingReport) {
    throw new AppError("Tu as déjà signalé cet avis", 400);
  }

  await db.insert(reviewReports).values({
    review_id: reviewId,
    reporter_id: reporterId,
    reason,
  });

  await db
    .update(reviews)
    .set({ is_flagged: 1, flag_reason: reason })
    .where(eq(reviews.id, reviewId));

  return { success: true };
}

// ============================================================
// LECTURE — UN AVIS PAR ID
// ============================================================

export async function getReviewById(reviewId: number) {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) {
    throw new AppError("Avis introuvable", 404);
  }

  return review;
}

// ============================================================
// NOTE GLOBALE VENDEUR (batch + single)
// ============================================================

/**
 * Retourne la note globale d'un vendeur (moyenne + nombre d'avis).
 * Exclut les avis signalés (is_flagged = 0).
 */
export async function getSellerGlobalRating(
  sellerId: number
): Promise<{ average: number; count: number }> {
  const [row] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::numeric(3,1)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(eq(reviews.seller_id, sellerId), eq(reviews.is_flagged, 0))
    );

  return {
    average: Number(row?.avg ?? 0),
    count: row?.count ?? 0,
  };
}

/**
 * Retourne les notes globales de plusieurs vendeurs (batch anti N+1).
 * Les sellers sans avis sont renvoyés avec { average: 0, count: 0 }.
 */
export async function getBulkSellerRatings(
  sellerIds: number[]
): Promise<Map<number, { average: number; count: number }>> {
  const result = new Map<number, { average: number; count: number }>();
  if (sellerIds.length === 0) return result;

  const uniqueIds = Array.from(new Set(sellerIds));

  const rows = await db
    .select({
      seller_id: reviews.seller_id,
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::numeric(3,1)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(
        inArray(reviews.seller_id, uniqueIds),
        eq(reviews.is_flagged, 0)
      )
    )
    .groupBy(reviews.seller_id);

  for (const r of rows) {
    result.set(r.seller_id, {
      average: Number(r.avg ?? 0),
      count: r.count ?? 0,
    });
  }

  for (const id of uniqueIds) {
    if (!result.has(id)) {
      result.set(id, { average: 0, count: 0 });
    }
  }

  return result;
}

// ============================================================
// RÉPONSE DU VENDEUR À UN AVIS
// ============================================================
export async function replyToReview(
  reviewId: number,
  sellerId: number,
  replyText: string
) {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) throw new AppError("Avis introuvable", 404);

  if (review.seller_id !== sellerId) {
    throw new AppError("Tu ne peux répondre qu'aux avis de tes clients", 403);
  }

  const [updated] = await db
    .update(reviews)
    .set({
      reply_text: replyText,
      replied_at: new Date(),
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  return updated;
}

// ============================================================
// MODIFICATION D'UN AVIS (par l'auteur)
// ============================================================
export async function updateReview(
  reviewId: number,
  authorId: number,
  input: UpdateReviewInput
) {
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) throw new AppError("Avis introuvable", 404);

  if (review.author_id !== authorId) {
    throw new AppError("Tu ne peux modifier que tes propres avis", 403);
  }

  const dataToUpdate: any = { updated_at: new Date() };
  if (input.rating !== undefined) dataToUpdate.rating = input.rating;
  if (input.comment !== undefined) dataToUpdate.comment = input.comment;

  const [updated] = await db
    .update(reviews)
    .set(dataToUpdate)
    .where(eq(reviews.id, reviewId))
    .returning();

  return updated;
}
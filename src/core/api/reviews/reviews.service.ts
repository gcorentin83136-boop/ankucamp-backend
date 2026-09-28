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
import type {
  CreateReviewInput,
  ListReviewsQuery,
} from "./reviews.validation";

// ============================================================
// CRÉATION D'UN AVIS
// ============================================================

/**
 * Crée un avis sur un produit acheté.
 *
 * Règles :
 * - Seul l'acheteur de la commande peut noter
 * - La commande doit être au statut "delivered"
 * - Le produit doit faire partie de la commande
 * - 1 seul avis par (order_id + product_id)
 */
export async function createReview(
  authorId: number,
  input: CreateReviewInput
) {
  const { order_id, product_id, rating, comment } = input;

  // 1. Charge la commande
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, order_id))
    .limit(1);

  if (!order) {
    throw new AppError("Commande introuvable", 404);
  }

  // 2. Vérifie que l'auteur est l'acheteur
  if (order.buyer_id !== authorId) {
    throw new AppError("Seul l'acheteur peut laisser un avis", 403);
  }

  // 3. Vérifie que la commande est livrée
  if (order.status !== "delivered") {
    throw new AppError(
      "Tu peux laisser un avis uniquement après réception de la commande",
      400
    );
  }

  // 4. Vérifie que le produit fait partie de la commande
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

  // 5. Vérifie qu'un avis n'existe pas déjà
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

  // 6. Crée l'avis
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

  return review;
}

// ============================================================
// LECTURE — AVIS PAR PRODUIT
// ============================================================

/**
 * Liste les avis d'un produit avec les infos de l'auteur.
 * Exclut les avis signalés (is_flagged = 1).
 */
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
      author_avatar_url: users.avatar_url,
    })
    .from(reviews)
    .leftJoin(users, eq(users.id, reviews.author_id))
    .where(and(eq(reviews.product_id, productId), eq(reviews.is_flagged, 0)))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return rows;
}

// ============================================================
// LECTURE — AVIS PAR VENDEUR
// ============================================================

/**
 * Liste les avis reçus par un vendeur (toutes ses ventes).
 */
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
    })
    .from(reviews)
    .leftJoin(products, eq(products.id, reviews.product_id))
    .leftJoin(users, eq(users.id, reviews.author_id))
    .where(eq(reviews.seller_id, sellerId))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return rows;
}

// ============================================================
// LECTURE — MES AVIS (auteur)
// ============================================================

/**
 * Liste les avis rédigés par un utilisateur.
 */
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

/**
 * Retourne la note moyenne, le nombre d'avis et la distribution (1-5 étoiles)
 * pour un produit donné.
 */
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

/**
 * Calcule les stats de plusieurs produits en 1 seule requête.
 * Utile pour les listes de produits.
 */
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

/**
 * Supprime un avis. Seul l'auteur peut supprimer son propre avis.
 */
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

/**
 * Signale un avis (par le vendeur concerné uniquement).
 * Marque l'avis comme signalé (is_flagged = 1) et enregistre la raison.
 */
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

  // Seul le vendeur concerné peut signaler
  if (review.seller_id !== reporterId) {
    throw new AppError("Seul le vendeur concerné peut signaler cet avis", 403);
  }

  // Vérifie qu'il n'a pas déjà signalé
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

  // Enregistre le signalement
  await db.insert(reviewReports).values({
    review_id: reviewId,
    reporter_id: reporterId,
    reason,
  });

  // Marque l'avis comme signalé
  await db
    .update(reviews)
    .set({ is_flagged: 1, flag_reason: reason })
    .where(eq(reviews.id, reviewId));

  return { success: true };
}

// ============================================================
// LECTURE — UN AVIS PAR ID
// ============================================================

/**
 * Récupère un avis par son ID.
 */
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
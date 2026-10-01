import { eq, and, desc, sql, gte, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../../../db";
import {
  orders,
  orderItems,
  products,
  payments,
  reviews,
  refundRequests,
  users,
} from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { getMyLastKycRequest } from "../../kyc/kyc.service";
import { getUserBadges } from "../../badges/badges.service";

// ============================================================
// STATS GLOBALES SELLER
// ============================================================

export async function getSellerStats(sellerId: number) {
  // 1. CA total (payments succeeded sur les commandes du seller)
  const [revenueRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.seller_amount}), 0)::text`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.seller_id, sellerId),
        eq(payments.status, "succeeded")
      )
    );

  // 2. CA du mois en cours
  const [monthRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.seller_amount}), 0)::text`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.seller_id, sellerId),
        eq(payments.status, "succeeded"),
        gte(payments.created_at, sql`date_trunc('month', now())`)
      )
    );

  // 3. CA 12 derniers mois
  const [yearRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.seller_amount}), 0)::text`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.seller_id, sellerId),
        eq(payments.status, "succeeded"),
        gte(payments.created_at, sql`now() - interval '12 months'`)
      )
    );

  // 4. Nombre de produits (via les shops du seller)
  const [productsCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      sql`${products.shop_id} IN (
        SELECT id FROM shops WHERE owner_id = ${sellerId}
      )`
    );

  // 5. Note moyenne (tous avis confondus, hors avis signalés)
  const [ratingRow] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::numeric(3,1)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.seller_id, sellerId),
        eq(reviews.is_flagged, 0)
      )
    );

  return {
    revenue: {
      total: revenueRow?.total ?? "0",
      this_month: monthRow?.total ?? "0",
      last_12_months: yearRow?.total ?? "0",
    },
    products_count: productsCountRow?.count ?? 0,
    rating: {
      average: Number(ratingRow?.avg ?? 0),
      count: ratingRow?.count ?? 0,
    },
  };
}

// ============================================================
// BREAKDOWN DES COMMANDES (par statut)
// ============================================================

export async function getSellerOrdersBreakdown(sellerId: number) {
  const rows = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(eq(orders.seller_id, sellerId))
    .groupBy(orders.status);

  const breakdown: Record<string, number> = {
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
  };

  for (const r of rows) {
    breakdown[r.status] = r.count;
  }

  return {
    ...breakdown,
    to_treat: breakdown.pending,
    to_ship: breakdown.confirmed,
    in_progress: breakdown.shipped,
    completed: breakdown.delivered,
    cancelled_or_refunded: breakdown.cancelled + breakdown.refunded,
  };
}

// ============================================================
// CA 12 MOIS (graphique)
// ============================================================

export async function getSellerRevenueChart(sellerId: number, months = 12) {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${payments.created_at}), 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${payments.seller_amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.seller_id, sellerId),
        eq(payments.status, "succeeded"),
        gte(
          payments.created_at,
          sql`now() - (${months} || ' months')::interval`
        )
      )
    )
    .groupBy(sql`date_trunc('month', ${payments.created_at})`)
    .orderBy(sql`date_trunc('month', ${payments.created_at})`);

  return rows;
}

// ============================================================
// TOP 5 PRODUITS VENDUS
// ============================================================

export async function getTopProducts(sellerId: number, limit = 5) {
  const rows = await db
    .select({
      product_id: orderItems.product_id,
      product_name: products.name,
      total_sold: sql<number>`sum(${orderItems.quantity})::int`,
      total_revenue: sql<string>`sum(${orderItems.unit_price} * ${orderItems.quantity})::text`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.order_id))
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(
      and(
        eq(orders.seller_id, sellerId),
        ne(orders.status, "cancelled"),
        ne(orders.status, "refunded")
      )
    )
    .groupBy(orderItems.product_id, products.name)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(limit);

  return rows;
}

// ============================================================
// NOTES PAR PRODUIT
// ============================================================

export async function getSellerRatings(sellerId: number) {
  const [globalRating] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::numeric(3,1)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.seller_id, sellerId),
        eq(reviews.is_flagged, 0)
      )
    );

  const byProduct = await db
    .select({
      product_id: reviews.product_id,
      product_name: products.name,
      avg_rating: sql<number>`coalesce(avg(${reviews.rating}), 0)::numeric(3,1)`,
      reviews_count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .leftJoin(products, eq(products.id, reviews.product_id))
    .where(
      and(
        eq(reviews.seller_id, sellerId),
        eq(reviews.is_flagged, 0)
      )
    )
    .groupBy(reviews.product_id, products.name)
    .orderBy(desc(sql`avg(${reviews.rating})`));

  return {
    global: {
      average: Number(globalRating?.avg ?? 0),
      count: globalRating?.count ?? 0,
    },
    by_product: byProduct,
  };
}

// ============================================================
// 5 DERNIERS AVIS REÇUS
// ============================================================

export async function getRecentReviews(sellerId: number, limit = 5) {
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.seller_id, sellerId))
    .orderBy(desc(reviews.created_at))
    .limit(limit);

  return rows;
}

// ============================================================
// COMMANDES RÉCENTES À TRAITER
// ============================================================

export async function getRecentOrdersToTreat(sellerId: number, limit = 10) {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.seller_id, sellerId),
        inArray(orders.status, ["pending", "confirmed", "shipped"])
      )
    )
    .orderBy(desc(orders.created_at))
    .limit(limit);

  return rows;
}

// ============================================================
// VERIFICATION PRO + BADGES (widget dashboard seller)
// ============================================================

export async function getSellerVerification(sellerId: number) {
  const [userRow] = await db
    .select({ verification_status: users.verification_status })
    .from(users)
    .where(eq(users.id, sellerId))
    .limit(1);

  const lastRequest = await getMyLastKycRequest(sellerId);
  const badges = await getUserBadges(sellerId);

  return {
    verification_status: userRow?.verification_status ?? "none",
    last_request: lastRequest
      ? {
          id: lastRequest.id,
          status: lastRequest.status,
          type: lastRequest.type,
          siret: lastRequest.siret,
          created_at: lastRequest.created_at,
          reviewed_at: lastRequest.reviewed_at,
          rejection_reason: lastRequest.rejection_reason,
        }
      : null,
    badges,
  };
}
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
  promoCodes,
  events,
  eventRegistrations,
  articles,
  kycRequests,
  shops,
} from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { getMyLastKycRequest } from "../../kyc/kyc.service";
import { getUserBadges } from "../../badges/badges.service";

// ============================================================
// STATS GLOBALES SELLER
// ============================================================

export async function getSellerStats(sellerId: number) {
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

  const [productsCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      sql`${products.shop_id} IN (
        SELECT id FROM shops WHERE owner_id = ${sellerId}
      )`
    );

  const [ratingRow] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::numeric(3,1)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(eq(reviews.seller_id, sellerId), eq(reviews.is_flagged, 0))
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
      and(eq(reviews.seller_id, sellerId), eq(reviews.is_flagged, 0))
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
      and(eq(reviews.seller_id, sellerId), eq(reviews.is_flagged, 0))
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

// ============================================================
// SUMMARY — Vue agrégée complète pour le dashboard seller
// ============================================================

export async function getSellerSummary(sellerId: number) {
  const now = new Date();

  const [ordersPending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.seller_id, sellerId), eq(orders.status, "pending")));

  const [ordersShipped] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.seller_id, sellerId), eq(orders.status, "shipped")));

  const [refundsPending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(refundRequests)
    .innerJoin(orders, eq(orders.id, refundRequests.order_id))
    .where(
      and(
        eq(orders.seller_id, sellerId),
        eq(refundRequests.status, "pending")
      )
    );

  const [revenueAll] = await db
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

  const [revenueMonth] = await db
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

  const [ratingRow] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)::numeric(3,1)`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.seller_id, sellerId), eq(reviews.is_flagged, 0)));

  const [productsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      sql`${products.shop_id} IN (
        SELECT id FROM shops WHERE owner_id = ${sellerId}
      )`
    );

  const [shopsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shops)
    .where(eq(shops.owner_id, sellerId));

  const [promoActiveRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
      uses: sql<number>`coalesce(sum(${promoCodes.uses_count}), 0)::int`,
    })
    .from(promoCodes)
    .where(
      and(
        eq(promoCodes.seller_id, sellerId),
        eq(promoCodes.is_active, 1)
      )
    );

  const [eventsUpcomingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.organizer_id, sellerId),
        eq(events.status, "published"),
        gte(events.start_at, now)
      )
    );

  const [registrationsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .innerJoin(events, eq(events.id, eventRegistrations.event_id))
    .where(
      and(
        eq(events.organizer_id, sellerId),
        eq(eventRegistrations.status, "registered")
      )
    );

  const [articlesRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(
      and(
        eq(articles.author_id, sellerId),
        eq(articles.status, "published")
      )
    );

  const [kycRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kycRequests)
    .where(
      and(
        eq(kycRequests.user_id, sellerId),
        eq(kycRequests.status, "pending")
      )
    );

  return {
    to_treat: {
      orders_pending: ordersPending?.count ?? 0,
      orders_shipped: ordersShipped?.count ?? 0,
      refunds_pending: refundsPending?.count ?? 0,
      event_registrations: registrationsRow?.count ?? 0,
      kyc_pending: kycRow?.count ?? 0,
      total:
        (ordersPending?.count ?? 0) +
        (ordersShipped?.count ?? 0) +
        (refundsPending?.count ?? 0),
    },
    revenue: {
      all_time: revenueAll?.total ?? "0",
      this_month: revenueMonth?.total ?? "0",
    },
    rating: {
      average: Number(ratingRow?.avg ?? 0),
      count: ratingRow?.count ?? 0,
    },
    shops: shopsRow?.count ?? 0,
    products: productsRow?.count ?? 0,
    promo: {
      active_codes: promoActiveRow?.count ?? 0,
      total_uses: promoActiveRow?.uses ?? 0,
    },
    events: {
      upcoming: eventsUpcomingRow?.count ?? 0,
    },
    articles: {
      published: articlesRow?.count ?? 0,
    },
  };
}
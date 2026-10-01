import { eq, and, desc, sql, gte, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../../../db";
import {
  users,
  shops,
  products,
  orders,
  payments,
  reviews,
  refundRequests,
} from "../../../db/schema";
import { AppError } from "../../../errors/AppError";

// ============================================================
// STATS GLOBALES PLATEFORME
// ============================================================

export async function getAdminStats() {
  // 1. Users (total + vérifiés)
  const [usersRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`sum(case when email_verified = 1 then 1 else 0 end)::int`,
    })
    .from(users);

  // 2. Shops
  const [shopsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shops);

  // 3. Products
  const [productsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products);

  // 4. Orders (total + par statut)
  const [ordersRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)::int`,
      confirmed: sql<number>`sum(case when status = 'confirmed' then 1 else 0 end)::int`,
      shipped: sql<number>`sum(case when status = 'shipped' then 1 else 0 end)::int`,
      delivered: sql<number>`sum(case when status = 'delivered' then 1 else 0 end)::int`,
      cancelled: sql<number>`sum(case when status = 'cancelled' then 1 else 0 end)::int`,
      refunded: sql<number>`sum(case when status = 'refunded' then 1 else 0 end)::int`,
    })
    .from(orders);

  // 5. CA plateforme (somme des application_fee_amount des payments succeeded)
  const [revenueRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.application_fee_amount}), 0)::text`,
    })
    .from(payments)
    .where(eq(payments.status, "succeeded"));

  // 6. Refunds pending
  const [refundsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(refundRequests)
    .where(eq(refundRequests.status, "pending"));

  // 7. Reviews signalées
  const [flaggedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.is_flagged, 1));

  return {
    users: {
      total: usersRow?.total ?? 0,
      verified: usersRow?.verified ?? 0,
    },
    shops: shopsRow?.count ?? 0,
    products: productsRow?.count ?? 0,
    orders: {
      total: ordersRow?.total ?? 0,
      pending: ordersRow?.pending ?? 0,
      confirmed: ordersRow?.confirmed ?? 0,
      shipped: ordersRow?.shipped ?? 0,
      delivered: ordersRow?.delivered ?? 0,
      cancelled: ordersRow?.cancelled ?? 0,
      refunded: ordersRow?.refunded ?? 0,
    },
    revenue: {
      // CA total TTC (tous les payments succeeded)
      total_gmv: revenueRow?.total ?? "0",
      // Commission plateforme = somme des application_fee_amount
      platform_fees: revenueRow?.total ?? "0",
    },
    pending_refunds: refundsRow?.count ?? 0,
    flagged_reviews: flaggedRow?.count ?? 0,
  };
}

// ============================================================
// 50 DERNIERS INSCRITS
// ============================================================

export async function getRecentUsers(limit = 50) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      role: users.role,
      avatar_url: users.avatar_url,
      email_verified: users.email_verified,
      created_at: users.created_at,
    })
    .from(users)
    .orderBy(desc(users.created_at))
    .limit(limit);

  return rows;
}

// ============================================================
// 50 DERNIÈRES COMMANDES
// ============================================================

export async function getRecentOrders(limit = 50) {
  const rows = await db
    .select({
      id: orders.id,
      buyer_id: orders.buyer_id,
      seller_id: orders.seller_id,
      total_price: orders.total_price,
      status: orders.status,
      delivery_method: orders.delivery_method,
      created_at: orders.created_at,
    })
    .from(orders)
    .orderBy(desc(orders.created_at))
    .limit(limit);

  return rows;
}

// ============================================================
// CA 12 MOIS (graphique)
// ============================================================

export async function getRevenueChart(months = 12) {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${payments.created_at}), 'YYYY-MM')`,
      gmv: sql<string>`coalesce(sum(${payments.amount_ttc}), 0)::text`,
      fees: sql<string>`coalesce(sum(${payments.application_fee_amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(
      and(
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
// MODÉRATION (reviews signalées)
// ============================================================

export async function getModerationList() {
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.is_flagged, 1))
    .orderBy(desc(reviews.created_at));

  return rows;
}

// ============================================================
// REFUNDS PENDING (à traiter)
// ============================================================

export async function getPendingRefunds(limit = 50) {
  const rows = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.status, "pending"))
    .orderBy(desc(refundRequests.requested_at))
    .limit(limit);

  return rows;
}
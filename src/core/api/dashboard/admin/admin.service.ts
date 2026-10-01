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
  kycRequests,
  contentReports,
  promoCodes,
  events,
  articles,
  categories,
  dataExportRequests,
  accountDeletionRequests,
  userBadges,
} from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { getKycStats } from "../../kyc/kyc.service";

// ============================================================
// STATS GLOBALES PLATEFORME
// ============================================================

export async function getAdminStats() {
  const [usersRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`sum(case when email_verified = 1 then 1 else 0 end)::int`,
    })
    .from(users);

  const [shopsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shops);

  const [productsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products);

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

  const [revenueRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.application_fee_amount}), 0)::text`,
    })
    .from(payments)
    .where(eq(payments.status, "succeeded"));

  const [refundsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(refundRequests)
    .where(eq(refundRequests.status, "pending"));

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
      total_gmv: revenueRow?.total ?? "0",
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

// ============================================================
// KYC - RESUME DASHBOARD
// ============================================================

export async function getKycSummaryForDashboard() {
  const stats = await getKycStats();

  const pending = await db
    .select({
      id: kycRequests.id,
      user_id: kycRequests.user_id,
      type: kycRequests.type,
      siret: kycRequests.siret,
      created_at: kycRequests.created_at,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      avatar_url: users.avatar_url,
    })
    .from(kycRequests)
    .innerJoin(users, eq(users.id, kycRequests.user_id))
    .where(eq(kycRequests.status, "pending"))
    .orderBy(desc(kycRequests.created_at))
    .limit(5);

  return { stats, pending };
}

// ============================================================
// SUMMARY — Vue agrégée complète pour le dashboard admin
// ============================================================

export async function getAdminSummary() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Compteurs "à traiter"
  const [kycPending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kycRequests)
    .where(eq(kycRequests.status, "pending"));

  const [reportsPending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentReports)
    .where(eq(contentReports.status, "pending"));

  const [refundsPending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(refundRequests)
    .where(eq(refundRequests.status, "pending"));

  const [reviewsFlagged] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.is_flagged, 1));

  const [rgpdPending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dataExportRequests)
    .where(eq(dataExportRequests.status, "pending"));

  const [deletionsPending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.status, "pending"));

  // 2. Stats globales
  const [usersRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`sum(case when email_verified = 1 then 1 else 0 end)::int`,
      pros: sql<number>`sum(case when role = 'professionnel' then 1 else 0 end)::int`,
    })
    .from(users);

  const [shopsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shops);

  const [productsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products);

  const [categoriesRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories);

  const [articlesRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`sum(case when status = 'published' then 1 else 0 end)::int`,
    })
    .from(articles);

  const [badgesRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userBadges)
    .where(sql`revoked_at IS NULL`);

  // 3. CA plateforme
  const [revenueRow] = await db
    .select({
      gmv: sql<string>`coalesce(sum(${payments.amount_ttc}), 0)::text`,
      fees: sql<string>`coalesce(sum(${payments.application_fee_amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(eq(payments.status, "succeeded"));

  const [revenueMonthRow] = await db
    .select({
      gmv: sql<string>`coalesce(sum(${payments.amount_ttc}), 0)::text`,
      fees: sql<string>`coalesce(sum(${payments.application_fee_amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "succeeded"),
        gte(payments.created_at, sql`date_trunc('month', now())`)
      )
    );

  // 4. Codes promo actifs
  const [promoActiveRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promoCodes)
    .where(eq(promoCodes.is_active, 1));

  // 5. Événements à venir
  const [eventsUpcomingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(eq(events.status, "published"), gte(events.start_at, now))
    );

  const [eventsWeekRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.status, "published"),
        gte(events.start_at, now),
        sql`${events.start_at} <= ${in7Days}`
      )
    );

  // 6. Derniers signalements pending
  const recentReports = await db
    .select({
      id: contentReports.id,
      target_type: contentReports.target_type,
      target_id: contentReports.target_id,
      reason: contentReports.reason,
      created_at: contentReports.created_at,
      reporter_username: users.username,
    })
    .from(contentReports)
    .leftJoin(users, eq(users.id, contentReports.reporter_id))
    .where(eq(contentReports.status, "pending"))
    .orderBy(desc(contentReports.created_at))
    .limit(5);

  // 7. Derniers KYC pending
  const recentKyc = await db
    .select({
      id: kycRequests.id,
      user_id: kycRequests.user_id,
      type: kycRequests.type,
      created_at: kycRequests.created_at,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(kycRequests)
    .innerJoin(users, eq(users.id, kycRequests.user_id))
    .where(eq(kycRequests.status, "pending"))
    .orderBy(desc(kycRequests.created_at))
    .limit(5);

  return {
    to_treat: {
      kyc_pending: kycPending?.count ?? 0,
      reports_pending: reportsPending?.count ?? 0,
      refunds_pending: refundsPending?.count ?? 0,
      reviews_flagged: reviewsFlagged?.count ?? 0,
      rgpd_exports_pending: rgpdPending?.count ?? 0,
      deletions_pending: deletionsPending?.count ?? 0,
      total:
        (kycPending?.count ?? 0) +
        (reportsPending?.count ?? 0) +
        (refundsPending?.count ?? 0) +
        (reviewsFlagged?.count ?? 0) +
        (rgpdPending?.count ?? 0) +
        (deletionsPending?.count ?? 0),
    },
    users: {
      total: usersRow?.total ?? 0,
      verified: usersRow?.verified ?? 0,
      pros: usersRow?.pros ?? 0,
    },
    shops: shopsRow?.count ?? 0,
    products: productsRow?.count ?? 0,
    categories: categoriesRow?.count ?? 0,
    badges_active: badgesRow?.count ?? 0,
    articles: {
      total: articlesRow?.total ?? 0,
      published: articlesRow?.published ?? 0,
    },
    revenue: {
      all_time: {
        gmv: revenueRow?.gmv ?? "0",
        fees: revenueRow?.fees ?? "0",
        count: revenueRow?.count ?? 0,
      },
      this_month: {
        gmv: revenueMonthRow?.gmv ?? "0",
        fees: revenueMonthRow?.fees ?? "0",
        count: revenueMonthRow?.count ?? 0,
      },
    },
    promo: {
      active_codes: promoActiveRow?.count ?? 0,
    },
    events: {
      upcoming: eventsUpcomingRow?.count ?? 0,
      this_week: eventsWeekRow?.count ?? 0,
    },
    recent: {
      reports: recentReports,
      kyc: recentKyc,
    },
  };
}
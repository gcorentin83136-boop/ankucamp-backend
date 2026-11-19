import { eq, and, desc, sql, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "../../../db";
import {
  orders,
  payments,
  refundRequests,
  users,
  wishlists,
  carts,
  eventRegistrations,
  events,
  articleLikes,
} from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { resendInvoiceEmail } from "../../orders/orders.emails";

// ============================================================
// STATS GLOBALES BUYER
// ============================================================

export async function getBuyerStats(buyerId: number) {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.buyer_id, buyerId));

  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.buyer_id, buyerId),
        inArray(orders.status, ["pending", "confirmed", "shipped"])
      )
    );

  const [deliveredRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(eq(orders.buyer_id, buyerId), eq(orders.status, "delivered"))
    );

  const [cancelledRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.buyer_id, buyerId),
        inArray(orders.status, ["cancelled", "refunded"])
      )
    );

  const [spentRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amount_ttc}), 0)::text`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.user_id, buyerId),
        eq(payments.status, "succeeded")
      )
    );

  return {
    orders: {
      total: totalRow?.count ?? 0,
      pending: pendingRow?.count ?? 0,
      delivered: deliveredRow?.count ?? 0,
      cancelled: cancelledRow?.count ?? 0,
    },
    total_spent: spentRow?.total ?? "0",
  };
}

// ============================================================
// 5 DERNIÈRES COMMANDES
// ============================================================

export async function getRecentOrders(buyerId: number, limit = 5) {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.buyer_id, buyerId))
    .orderBy(desc(orders.created_at))
    .limit(limit);

  return rows;
}

// ============================================================
// 5 DERNIÈRES DEMANDES DE REMBOURSEMENT
// ============================================================

export async function getRecentRefunds(buyerId: number, limit = 5) {
  const rows = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.requested_by, buyerId))
    .orderBy(desc(refundRequests.requested_at))
    .limit(limit);

  return rows;
}

// ============================================================
// LISTE DES FACTURES
// ============================================================

export async function getMyInvoices(buyerId: number) {
  const rows = await db
    .select({
      payment_id: payments.id,
      order_id: payments.order_id,
      amount_ttc: payments.amount_ttc,
      invoice_url: payments.invoice_url,
      status: payments.status,
      created_at: payments.created_at,
    })
    .from(payments)
    .where(
      and(
        eq(payments.user_id, buyerId),
        isNotNull(payments.invoice_url)
      )
    )
    .orderBy(desc(payments.created_at));

  return rows;
}

// ============================================================
// RENVOYER UNE FACTURE PAR EMAIL
// ============================================================

export async function resendMyInvoice(buyerId: number, orderId: number) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new AppError("Commande introuvable", 404);
  if (order.buyer_id !== buyerId) {
    throw new AppError("Vous n'êtes pas l'acheteur de cette commande", 403);
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (!payment || !payment.invoice_url) {
    throw new AppError("Aucune facture disponible pour cette commande", 400);
  }

  const [buyer] = await db
    .select({
      email: users.email,
      first_name: users.first_name,
    })
    .from(users)
    .where(eq(users.id, buyerId))
    .limit(1);

  if (!buyer) throw new AppError("Utilisateur introuvable", 404);

  await resendInvoiceEmail(orderId, buyer.email, buyer.first_name);

  console.log(
    `📧 Facture commande #${orderId} renvoyée à ${buyer.email} (buyer #${buyerId})`
  );

  return { success: true, email: buyer.email };
}

// ============================================================
// GRAPHIQUE DÉPENSES
// ============================================================

export async function getSpendingChart(buyerId: number, months = 12) {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${payments.created_at}), 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${payments.amount_ttc}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.user_id, buyerId),
        eq(payments.status, "succeeded"),
        gte(payments.created_at, sql`now() - (${months} || ' months')::interval`)
      )
    )
    .groupBy(sql`date_trunc('month', ${payments.created_at})`)
    .orderBy(sql`date_trunc('month', ${payments.created_at})`);

  return rows;
}

// ============================================================
// SUMMARY — Vue agrégée complète pour le dashboard buyer
// ============================================================

export async function getBuyerSummary(buyerId: number) {
  const now = new Date();

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.buyer_id, buyerId));

  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.buyer_id, buyerId),
        inArray(orders.status, ["pending", "confirmed", "shipped"])
      )
    );

  const [spentRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amount_ttc}), 0)::text`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.user_id, buyerId),
        eq(payments.status, "succeeded")
      )
    );

  const [wishlistRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wishlists)
    .where(eq(wishlists.user_id, buyerId));

  const [cartRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
      qty: sql<number>`coalesce(sum(${carts.quantity}), 0)::int`,
    })
    .from(carts)
    .where(eq(carts.user_id, buyerId));

  const myEventsUpcoming = await db
    .select({
      event_id: events.id,
      title: events.title,
      type: events.type,
      start_at: events.start_at,
      city: events.city,
      cover_url: events.cover_url,
      status: eventRegistrations.status,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(events.id, eventRegistrations.event_id))
    .where(
      and(
        eq(eventRegistrations.user_id, buyerId),
        inArray(eventRegistrations.status, ["registered", "waitlist"]),
        gte(events.start_at, now)
      )
    )
    .orderBy(events.start_at)
    .limit(5);

  const [eventsCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .innerJoin(events, eq(events.id, eventRegistrations.event_id))
    .where(
      and(
        eq(eventRegistrations.user_id, buyerId),
        inArray(eventRegistrations.status, ["registered", "waitlist"]),
        gte(events.start_at, now)
      )
    );

  const [articleLikesRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articleLikes)
    .where(eq(articleLikes.user_id, buyerId));

  return {
    orders: {
      total: totalRow?.count ?? 0,
      pending: pendingRow?.count ?? 0,
    },
    total_spent: spentRow?.total ?? "0",
    wishlist_count: wishlistRow?.count ?? 0,
    cart: {
      items_count: cartRow?.count ?? 0,
      total_quantity: cartRow?.qty ?? 0,
    },
    events: {
      upcoming_count: eventsCountRow?.count ?? 0,
      upcoming: myEventsUpcoming,
    },
    article_likes: articleLikesRow?.count ?? 0,
  };
}
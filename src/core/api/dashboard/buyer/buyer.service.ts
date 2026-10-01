import { eq, and, desc, sql, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "../../../db";
import {
  orders,
  payments,
  refundRequests,
  users,
} from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { resendInvoiceEmail } from "../../orders/orders.emails";

// ============================================================
// STATS GLOBALES BUYER
// ============================================================

export async function getBuyerStats(buyerId: number) {
  // 1. Compteurs de commandes (par statut)
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
      and(
        eq(orders.buyer_id, buyerId),
        eq(orders.status, "delivered")
      )
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

  // 2. Total dépensé (uniquement les paiements réussis)
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
// LISTE DES FACTURES (payments succeeded avec invoice_url)
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
  // 1. Vérifie que la commande appartient bien au buyer
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new AppError("Commande introuvable", 404);
  if (order.buyer_id !== buyerId) {
    throw new AppError("Vous n'êtes pas l'acheteur de cette commande", 403);
  }

  // 2. Vérifie qu'une facture existe
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (!payment || !payment.invoice_url) {
    throw new AppError(
      "Aucune facture disponible pour cette commande",
      400
    );
  }

  // 3. Récupère les infos du buyer
  const [buyer] = await db
    .select({
      email: users.email,
      first_name: users.first_name,
    })
    .from(users)
    .where(eq(users.id, buyerId))
    .limit(1);

  if (!buyer) throw new AppError("Utilisateur introuvable", 404);

  // 4. Envoie l'email
  await resendInvoiceEmail(orderId, buyer.email, buyer.first_name);

  console.log(
    `📧 Facture commande #${orderId} renvoyée à ${buyer.email} (buyer #${buyerId})`
  );

  return { success: true, email: buyer.email };
}

// ============================================================
// GRAPHIQUE DÉPENSES (12 derniers mois)
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
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  refundRequests,
  payments,
  orders,
  orderItems,
  products,
  users,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { stripe } from "../../../config/stripe";
import type {
  RequestRefundInput,
  ListRefundsQuery,
} from "./refunds.validation";

// ============================================================
// HELPERS
// ============================================================

/**
 * Vérifie que le user est bien l'acheteur de la commande.
 */
async function assertBuyer(orderId: number, userId: number) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new AppError("Commande introuvable", 404);
  if (order.buyer_id !== userId) {
    throw new AppError("Vous n'êtes pas l'acheteur de cette commande", 403);
  }

  return order;
}

// ============================================================
// DEMANDE DE REMBOURSEMENT (buyer)
// ============================================================

export async function requestRefund(
  buyerId: number,
  input: RequestRefundInput
) {
  const { order_id, reason } = input;

  // 1. Vérifie que la commande existe et appartient au buyer
  await assertBuyer(order_id, buyerId);

  // 2. Récupère le paiement associé
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, order_id))
    .limit(1);

  if (!payment) {
    throw new AppError(
      "Aucun paiement trouvé pour cette commande (la commande doit être payée)",
      400
    );
  }

  // 3. Le paiement doit être en status "succeeded"
  if (payment.status !== "succeeded") {
    throw new AppError(
      "Seuls les paiements réussis peuvent être remboursés",
      400
    );
  }

  // 4. Vérifie qu'il n'y a pas déjà une demande en cours
  const [existing] = await db
    .select()
    .from(refundRequests)
    .where(
      and(
        eq(refundRequests.order_id, order_id),
        inArray(refundRequests.status, ["pending", "approved", "refunded"])
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError(
      "Une demande de remboursement est déjà en cours pour cette commande",
      400
    );
  }

  // 5. Crée la demande
  const [created] = await db
    .insert(refundRequests)
    .values({
      order_id,
      payment_id: payment.id,
      requested_by: buyerId,
      reason,
      status: "pending",
      refund_amount: payment.amount_ttc,
    })
    .returning();

  console.log(
    `📩 Demande de remboursement créée pour commande #${order_id} (refund #${created.id})`
  );

  return created;
}

// ============================================================
// LECTURE — MES DEMANDES (buyer)
// ============================================================

export async function getMyRefunds(buyerId: number) {
  return db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.requested_by, buyerId))
    .orderBy(desc(refundRequests.requested_at));
}

// ============================================================
// LECTURE — TOUTES LES DEMANDES (admin)
// ============================================================

export async function getAllRefunds(query: ListRefundsQuery) {
  const { limit, offset, status } = query;

  if (status) {
    return db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.status, status))
      .orderBy(desc(refundRequests.requested_at))
      .limit(limit)
      .offset(offset);
  }

  return db
    .select()
    .from(refundRequests)
    .orderBy(desc(refundRequests.requested_at))
    .limit(limit)
    .offset(offset);
}

// ============================================================
// LECTURE — UNE DEMANDE (buyer ou admin)
// ============================================================

export async function getRefundById(
  refundId: number,
  userId: number,
  userRole: string
) {
  const [refund] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, refundId))
    .limit(1);

  if (!refund) throw new AppError("Demande de remboursement introuvable", 404);

  // Autorisé : le buyer qui a fait la demande OU un admin
  if (userRole !== "admin" && refund.requested_by !== userId) {
    throw new AppError("Vous n'avez pas accès à cette demande", 403);
  }

  return refund;
}

// ============================================================
// APPROBATION (admin) — appelle Stripe
// ============================================================

export async function approveRefund(
  refundId: number,
  adminId: number,
  adminComment?: string | null
) {
  // 1. Charge la demande
  const [refund] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, refundId))
    .limit(1);

  if (!refund) throw new AppError("Demande de remboursement introuvable", 404);

  if (refund.status !== "pending") {
    throw new AppError(
      `Cette demande a déjà été traitée (statut: ${refund.status})`,
      400
    );
  }

  // 2. Charge le paiement
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, refund.payment_id))
    .limit(1);

  if (!payment) throw new AppError("Paiement introuvable", 404);

  if (payment.status !== "succeeded") {
    throw new AppError(
      "Le paiement n'est pas dans un état remboursable",
      400
    );
  }

  // 3. Vérifie que le payment_intent est bien présent
  if (
    !payment.stripe_payment_intent ||
    payment.stripe_payment_intent === "pending" ||
    payment.stripe_payment_intent === "unknown"
  ) {
    throw new AppError(
      "Impossible de rembourser : identifiant Stripe manquant",
      400
    );
  }

  // 4. Appel Stripe : crée le remboursement
  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent,
      // ✅ reverse_transfer : annule le transfert vers le vendeur
      reverse_transfer: true,
      // ✅ refund_application_fee : la plateforme rembourse aussi sa commission
      refund_application_fee: true,
      reason: "requested_by_customer",
      metadata: {
        refund_request_id: String(refund.id),
        order_id: String(refund.order_id),
        admin_id: String(adminId),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur Stripe inconnue";

    // Marque comme failed
    await db
      .update(refundRequests)
      .set({
        status: "failed",
        admin_id: adminId,
        admin_comment: `Échec Stripe : ${message}`,
        processed_at: new Date(),
      })
      .where(eq(refundRequests.id, refundId));

    console.error(`❌ Échec remboursement Stripe (refund #${refundId}):`, err);

    throw new AppError(`Remboursement refusé par Stripe : ${message}`, 400);
  }

  // 5. Met à jour la demande
  // ✅ FIX : on passe directement à "refunded" (pas "approved")
  // Car si Stripe a accepté, le remboursement est garanti.
  // Le webhook charge.refunded reste un filet de sécurité (idempotent).
  await db
    .update(refundRequests)
    .set({
      status: "refunded",
      stripe_refund_id: stripeRefund.id,
      admin_id: adminId,
      admin_comment: adminComment ?? null,
      processed_at: new Date(),
    })
    .where(eq(refundRequests.id, refundId));

  // 6. Met à jour le paiement
  await db
    .update(payments)
    .set({ status: "refunded" })
    .where(eq(payments.id, payment.id));

  // 7. Met à jour la commande → statut "refunded"
  await db
    .update(orders)
    .set({ status: "refunded" })
    .where(eq(orders.id, refund.order_id));

  // 8. Remet le stock
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.order_id, refund.order_id));

  for (const item of items) {
    await db
      .update(products)
      .set({
        // Remet la quantité dans le stock
        stock: (await getProductStock(item.product_id)) + item.quantity,
      })
      .where(eq(products.id, item.product_id));
  }

  console.log(
    `✅ Remboursement approuvé (refund #${refundId}, stripe_refund: ${stripeRefund.id})`
  );

  return {
    refund_id: refundId,
    stripe_refund_id: stripeRefund.id,
    status: "refunded",
  };
}

/**
 * Récupère le stock actuel d'un produit.
 */
async function getProductStock(productId: number): Promise<number> {
  const [product] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return product?.stock ?? 0;
}

// ============================================================
// REJET (admin)
// ============================================================

export async function rejectRefund(
  refundId: number,
  adminId: number,
  adminComment?: string | null
) {
  const [refund] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, refundId))
    .limit(1);

  if (!refund) throw new AppError("Demande de remboursement introuvable", 404);

  if (refund.status !== "pending") {
    throw new AppError(
      `Cette demande a déjà été traitée (statut: ${refund.status})`,
      400
    );
  }

  await db
    .update(refundRequests)
    .set({
      status: "rejected",
      admin_id: adminId,
      admin_comment: adminComment ?? null,
      processed_at: new Date(),
    })
    .where(eq(refundRequests.id, refundId));

  console.log(`🚫 Remboursement rejeté (refund #${refundId} par admin #${adminId})`);

  return { refund_id: refundId, status: "rejected" };
}

// ============================================================
// HELPERS PUBLICS (pour le webhook charge.refunded)
// ============================================================

/**
 * Trouve un refund_request par son stripe_refund_id.
 */
export async function findRefundByStripeId(stripeRefundId: string) {
  const [refund] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.stripe_refund_id, stripeRefundId))
    .limit(1);

  return refund ?? null;
}

/**
 * Marque un refund_request comme "refunded" (webhook).
 */
export async function markRefundAsRefunded(refundId: number) {
  await db
    .update(refundRequests)
    .set({ status: "refunded" })
    .where(eq(refundRequests.id, refundId));

  console.log(`✅ Refund #${refundId} marqué comme refunded (webhook)`);
}
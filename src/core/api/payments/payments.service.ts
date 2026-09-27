import { eq } from "drizzle-orm";
import { db } from "../../db";
import { payments, orders, orderItems, products, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { stripe } from "../../../config/stripe";
import { env } from "../../../config/env";

const FRONTEND_URL =
  env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://ankucamp.com";

// ============================================================
// STRIPE CONNECT — ONBOARDING DU PRO
// ============================================================

/**
 * Crée (ou récupère) un compte Stripe Express pour un pro.
 */
export async function createConnectOnboardingLink(userId: number): Promise<string> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  if (user.role !== "professionnel") {
    throw new AppError("Seuls les professionnels peuvent se connecter à Stripe", 403);
  }

  let accountId = user.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "FR",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        user_id: String(user.id),
      },
    });

    accountId = account.id;

    await db
      .update(users)
      .set({
        stripe_account_id: accountId,
        stripe_account_status: "pending",
      })
      .where(eq(users.id, userId));
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${FRONTEND_URL}/dashboard/stripe/refresh`,
    return_url: `${FRONTEND_URL}/dashboard/stripe/return`,
    type: "account_onboarding",
  });

  return accountLink.url;
}

/**
 * Vérifie le statut du compte Connect d'un pro.
 */
export async function getConnectStatus(userId: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  if (!user.stripe_account_id) {
    return {
      status: "not_connected",
      charges_enabled: false,
      payouts_enabled: false,
    };
  }

  const account = await stripe.accounts.retrieve(user.stripe_account_id);

  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;

  let status: string;
  if (chargesEnabled && payoutsEnabled) {
    status = "active";
  } else if (account.details_submitted) {
    status = "pending_verification";
  } else {
    status = "pending";
  }

  if (user.stripe_account_status !== status) {
    await db
      .update(users)
      .set({ stripe_account_status: status })
      .where(eq(users.id, userId));
  }

  return {
    status,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    account_id: account.id,
  };
}

// ============================================================
// CHECKOUT avec Stripe Connect
// ============================================================

export async function createCheckoutSession(
  buyerId: number,
  orderId: number
): Promise<{ url: string; sessionId: string }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new AppError("Commande introuvable", 404);
  if (order.buyer_id !== buyerId) {
    throw new AppError("Vous n'êtes pas l'acheteur de cette commande", 403);
  }

  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (existingPayment && existingPayment.status === "succeeded") {
    throw new AppError("Cette commande a déjà été payée", 400);
  }

  const [seller] = await db
    .select()
    .from(users)
    .where(eq(users.id, order.seller_id))
    .limit(1);

  if (!seller) throw new AppError("Vendeur introuvable", 404);

  if (!seller.stripe_account_id) {
    throw new AppError(
      "Le vendeur n'a pas encore connecté son compte Stripe",
      400
    );
  }

  if (seller.stripe_account_status !== "active") {
    throw new AppError(
      "Le compte Stripe du vendeur n'est pas encore activé",
      400
    );
  }

  const items = await db
    .select({
      quantity: orderItems.quantity,
      unit_price: orderItems.unit_price,
      productName: products.name,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(eq(orderItems.order_id, orderId));

  const totalAmount = Number(order.total_price);
  const feePercent = env.PLATFORM_FEE_PERCENT;
  const applicationFee = Math.round(totalAmount * (feePercent / 100) * 100);
  const sellerAmount = totalAmount - applicationFee / 100;

  const lineItems = items.map((item) => ({
    price_data: {
      currency: "eur",
      product_data: { name: item.productName ?? "Produit" },
      unit_amount: Math.round(Number(item.unit_price) * 100),
    },
    quantity: item.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/payment/cancel`,
    metadata: {
      order_id: String(order.id),
      buyer_id: String(buyerId),
      seller_id: String(seller.id),
    },
    payment_intent_data: {
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: seller.stripe_account_id,
      },
    },
  });

  if (!session.url || !session.id) {
    throw new AppError("Erreur lors de la création de la session Stripe", 500);
  }

  await db.insert(payments).values({
    order_id: order.id,
    user_id: buyerId,
    seller_id: seller.id,
    seller_stripe_account_id: seller.stripe_account_id,
    stripe_payment_intent: "pending",
    stripe_session_id: session.id,
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: String(totalAmount),
    tva_rate: "0",
    application_fee_amount: String(applicationFee / 100),
    seller_amount: String(sellerAmount),
    status: "pending",
  });

  return { url: session.url, sessionId: session.id };
}

// ============================================================
// LECTURE
// ============================================================

export async function getPaymentsByUser(userId: number) {
  return db.select().from(payments).where(eq(payments.user_id, userId));
}

export async function getPaymentByOrder(orderId: number, userId: number) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (!payment) throw new AppError("Aucun paiement pour cette commande", 404);

  if (payment.user_id !== userId && payment.seller_id !== userId) {
    throw new AppError("Vous n'avez pas accès à ce paiement", 403);
  }

  return payment;
}

// ============================================================
// WEBHOOK
// ============================================================

export async function handleStripeEvent(event: {
  type: string;
  data: { object: any };
}) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = Number(session.metadata?.order_id);
      if (!orderId) return;

      await db
        .update(payments)
        .set({
          status: "succeeded",
          stripe_payment_intent: session.payment_intent?.toString() ?? "unknown",
        })
        .where(eq(payments.order_id, orderId));

      await db
        .update(orders)
        .set({ status: "confirmed" })
        .where(eq(orders.id, orderId));

      console.log(`✅ Paiement confirmé pour commande ${orderId}`);
      break;
    }

    case "account.updated": {
      const account = event.data.object;
      const userId = Number(account.metadata?.user_id);

      if (userId) {
        let status = "pending";
        if (account.charges_enabled && account.payouts_enabled) {
          status = "active";
        } else if (account.details_submitted) {
          status = "pending_verification";
        }

        await db
          .update(users)
          .set({ stripe_account_status: status })
          .where(eq(users.id, userId));

        console.log(`✅ Compte Stripe du user ${userId} → ${status}`);
      }
      break;
    }

    case "checkout.session.expired":
    case "payment_intent.payment_failed": {
      const session = event.data.object;
      const orderId = Number(session.metadata?.order_id);
      if (orderId) {
        await db
          .update(payments)
          .set({ status: "failed" })
          .where(eq(payments.order_id, orderId));
      }
      break;
    }
  }
}
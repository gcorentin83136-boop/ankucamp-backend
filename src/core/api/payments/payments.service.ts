import PDFDocument from "pdfkit";
import { eq , desc } from "drizzle-orm";
import { db } from "../../db";
import { payments, orders, orderItems, products, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { stripe } from "../../../config/stripe";
import { env } from "../../../config/env";
import { notifyNewOrder } from "../../notifications/notifications.helper";

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

export async function getPaymentsBySeller(sellerId: number) {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.seller_id, sellerId))
    .orderBy(desc(payments.created_at));

  return rows;
}

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

      // ============================================================
      // ⚠️ IDEMPOTENCE
      // ============================================================
      const [existingPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.order_id, orderId))
        .limit(1);

      if (
        existingPayment?.status === "succeeded" &&
        existingPayment?.invoice_url
      ) {
        console.log(
          `ℹ️  Webhook déjà traité pour commande #${orderId} (facture existante : ${existingPayment.invoice_url}), skip.`
        );
        return;
      }

      // ============================================================
      // TRAITEMENT NORMAL
      // ============================================================
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

      // 🔔 NOTIF VENDEUR : nouvelle commande
      try {
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (order) {
          const [buyer] = await db
            .select()
            .from(users)
            .where(eq(users.id, order.buyer_id))
            .limit(1);

          if (buyer) {
            await notifyNewOrder(
              order.seller_id,
              order.id,
              `${buyer.first_name} ${buyer.last_name}`,
              order.total_price
            );
          }
        }
      } catch (err) {
        console.error("❌ Erreur notif nouvelle commande:", err);
      }

      // 📧 Email de confirmation + facture (acheteur + vendeur)
      const { sendOrderConfirmationEmail } = await import(
        "../orders/orders.emails"
      );
      sendOrderConfirmationEmail(orderId).catch((err) =>
        console.error("❌ Erreur envoi email confirmation:", err)
      );

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

    // ============================================================
    // ✅ NOUVEAU : Webhook charge.refunded
    // Déclenché par Stripe après un remboursement effectif.
    // ============================================================
    case "charge.refunded": {
      const charge = event.data.object;
      const stripeRefundId = charge.refunds?.data?.[0]?.id;

      if (!stripeRefundId) {
        console.warn("⚠️  charge.refunded : pas de refund_id trouvé");
        break;
      }

      // Import dynamique pour éviter les cycles
      const { findRefundByStripeId, markRefundAsRefunded } = await import(
        "../refunds/refunds.service"
      );

      const refundReq = await findRefundByStripeId(stripeRefundId);

      if (!refundReq) {
        console.warn(
          `⚠️  charge.refunded : refund_request introuvable (stripe_id: ${stripeRefundId})`
        );
        break;
      }

      // Idempotence : si déjà "refunded", ne rien faire
      if (refundReq.status === "refunded") {
        console.log(
          `ℹ️  Refund #${refundReq.id} déjà marqué comme refunded, skip`
        );
        break;
      }

      await markRefundAsRefunded(refundReq.id);

      console.log(
        `✅ charge.refunded : refund #${refundReq.id} → status "refunded"`
      );

      break;
    }
  }
}

// ============================================================
// GÉNÉRATION PDF — Mes factures ANKU (seller)
// ============================================================
export async function generateSellerInvoicesPdf(
  sellerId: number,
  monthFilter?: string
): Promise<Buffer> {
  // 1. Récupérer les paiements
  let rows = await db
    .select()
    .from(payments)
    .where(eq(payments.seller_id, sellerId))
    .orderBy(desc(payments.created_at));

  // Filtrer par mois si demandé (format YYYY-MM)
  if (monthFilter && monthFilter !== "all") {
    rows = rows.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }

  // 2. Calculs totaux
  const totalTTC = rows.reduce(
    (s, r) => s + parseFloat(r.amount_ttc ?? "0"),
    0
  );
  const totalCommission = rows.reduce(
    (s, r) => s + parseFloat(r.application_fee_amount ?? "0"),
    0
  );
  const totalSeller = rows.reduce(
    (s, r) => s + parseFloat(r.seller_amount ?? "0"),
    0
  );

  // 3. Infos seller
  const [seller] = await db
    .select({
      first_name: users.first_name,
      last_name: users.last_name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, sellerId))
    .limit(1);

  // 4. Générer PDF
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const COLORS = {
        primary: "#6366f1",
        dark: "#1f2937",
        gray: "#6b7280",
        lightGray: "#f3f4f6",
        border: "#e5e7eb",
        red: "#dc2626",
        green: "#059669",
      };

      // HEADER
      doc
        .fillColor(COLORS.primary)
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("ANKU", 40, 40);

      doc
        .fillColor(COLORS.dark)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Mes factures ANKU", 250, 45, {
          align: "right",
          width: 305,
        });

      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica")
        .text(
          `Export du ${new Date().toLocaleDateString("fr-FR")}`,
          250,
          68,
          { align: "right", width: 305 }
        );

      if (monthFilter && monthFilter !== "all") {
        const [y, m] = monthFilter.split("-");
        const lbl = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString(
          "fr-FR",
          { month: "long", year: "numeric" }
        );
        doc.text(`Période : ${lbl}`, 250, 82, {
          align: "right",
          width: 305,
        });
      }

      doc
        .moveTo(40, 110)
        .lineTo(555, 110)
        .strokeColor(COLORS.primary)
        .lineWidth(2)
        .stroke();

      // INFO VENDEUR
      let y = 130;
      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("VENDEUR", 40, y);

      doc
        .fillColor(COLORS.dark)
        .fontSize(10)
        .font("Helvetica")
        .text(
          seller ? `${seller.first_name} ${seller.last_name}` : `Seller #${sellerId}`,
          40,
          y + 15
        )
        .text(seller?.email ?? "—", 40, y + 30);

      // RÉSUMÉ
      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("RÉSUMÉ", 350, y);

      doc
        .fillColor(COLORS.dark)
        .fontSize(10)
        .font("Helvetica")
        .text(`Ventes : ${rows.length}`, 350, y + 15)
        .text(`CA total : ${totalTTC.toFixed(2)} €`, 350, y + 30)
        .text(`Commission ANKU (2,5%) : ${totalCommission.toFixed(2)} €`, 350, y + 45)
        .fillColor(COLORS.green)
        .font("Helvetica-Bold")
        .text(`Net vendeur : ${totalSeller.toFixed(2)} €`, 350, y + 60);

      // TABLEAU
      y += 100;

      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("DÉTAIL DES VENTES", 40, y);

      y += 20;

      // Header tableau
      doc.rect(40, y, 515, 25).fillColor(COLORS.lightGray).fill();

      doc
        .fillColor(COLORS.dark)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Commande", 50, y + 8)
        .text("Date", 130, y + 8)
        .text("Montant vente", 240, y + 8, { width: 90, align: "right" })
        .text("Commission", 340, y + 8, { width: 90, align: "right" })
        .text("Net vendeur", 440, y + 8, { width: 100, align: "right" });

      y += 25;

      // Lignes
      doc.font("Helvetica").fontSize(9);

      for (const r of rows) {
        // Nouvelle page si on dépasse
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        const fee = parseFloat(r.application_fee_amount ?? "0");
        const sellerAmount = parseFloat(
          r.seller_amount ?? String(parseFloat(r.amount_ttc) - fee)
        );
        const dateStr = r.created_at
          ? new Date(r.created_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "—";

        doc
          .fillColor(COLORS.dark)
          .text(`#${r.order_id}`, 50, y + 6)
          .fillColor(COLORS.gray)
          .text(dateStr, 130, y + 6)
          .fillColor(COLORS.dark)
          .text(`${parseFloat(r.amount_ttc).toFixed(2)} €`, 240, y + 6, {
            width: 90,
            align: "right",
          })
          .fillColor(COLORS.red)
          .text(`-${fee.toFixed(2)} €`, 340, y + 6, {
            width: 90,
            align: "right",
          })
          .fillColor(COLORS.green)
          .font("Helvetica-Bold")
          .text(`${sellerAmount.toFixed(2)} €`, 440, y + 6, {
            width: 100,
            align: "right",
          })
          .font("Helvetica");

        doc
          .moveTo(40, y + 22)
          .lineTo(555, y + 22)
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .stroke();

        y += 22;
      }

      // Footer
      doc
        .fillColor(COLORS.gray)
        .fontSize(8)
        .font("Helvetica")
        .text(
          `© ${new Date().getFullYear()} ANKU — Récapitulatif commissions`,
          40,
          780,
          { align: "center", width: 515 }
        );

      doc.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur PDF";
      reject(new AppError(`Échec génération PDF : ${message}`, 500));
    }
  });
}
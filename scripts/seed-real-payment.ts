// ============================================================
// Script : cree un VRAI paiement Stripe test + un refund pending
// Usage : npx tsx scripts/seed-real-payment.ts
//
// ⚠️ Utilise tok_visa (token Stripe) au lieu du numéro de carte
//    car Stripe interdit les numéros bruts via l'API.
// ============================================================

import bcrypt from "bcrypt";
import { stripe } from "../src/config/stripe";
import { db } from "../src/core/db";
import {
  users, userSettings, shops, products, orders, orderItems, payments, refundRequests,
} from "../src/core/db/schema";

async function main() {
  const ts = Date.now();
  const password_hash = await bcrypt.hash("Test1234!", 10);

  // 1. Cree un PaymentMethod avec le token de test Stripe "tok_visa"
  //    (equivalent a la carte 4242 4242 4242 4242)
  console.log("1. Creation du PaymentMethod Stripe (tok_visa = carte 4242)...");
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });

  // 2. Cree et confirme le PaymentIntent
  console.log("2. Creation + confirmation du PaymentIntent Stripe...");
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 2500, // 25.00 EUR
    currency: "eur",
    payment_method: paymentMethod.id,
    confirm: true,
    description: `Test refund ANKU ${ts}`,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
  });

  console.log(`   ✅ PaymentIntent : ${paymentIntent.id}`);
  console.log(`   ✅ Status        : ${paymentIntent.status}`);

  if (paymentIntent.status !== "succeeded") {
    console.error("   ❌ PI pas en succeeded :", paymentIntent.status);
    process.exit(1);
  }

  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id ?? null;

  console.log(`   ✅ Charge ID     : ${chargeId}`);

  // 3. Cree le buyer
  const [buyer] = await db
    .insert(users)
    .values({
      first_name: "Test", last_name: "Buyer",
      username: `realbuyer_${ts}`, email: `realbuyer-${ts}@anku.local`,
      password_hash, role: "particulier", provider: "local", email_verified: 1,
    })
    .returning();

  // 4. Cree le seller
  const [seller] = await db
    .insert(users)
    .values({
      first_name: "Test", last_name: "Seller",
      username: `realseller_${ts}`, email: `realseller-${ts}@anku.local`,
      password_hash, role: "professionnel", provider: "local",
      email_verified: 1, verification_status: "verified",
    })
    .returning();

  // 5. Shop + Product
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: seller.id, name: `Ferme Test ${ts}`,
      description: "Ferme de test reel", city: "Lyon",
    })
    .returning();

  const [product] = await db
    .insert(products)
    .values({
      shop_id: shop.id, name: "Panier test reel",
      description: "Panier pour test Stripe reel",
      price: "25.00", stock: 100, location: "Lyon",
    })
    .returning();

  // 6. Order
  const [order] = await db
    .insert(orders)
    .values({
      buyer_id: buyer.id, seller_id: seller.id, status: "delivered",
      delivery_method: "pickup", total_price: "25.00",
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: order.id, product_id: product.id, quantity: 1, unit_price: "25.00",
  });

  // 7. Payment BDD lie au VRAI PI Stripe
  const [payment] = await db
    .insert(payments)
    .values({
      order_id: order.id,
      user_id: buyer.id,
      seller_id: seller.id,
      stripe_payment_intent: paymentIntent.id,
      stripe_session_id: `cs_real_test_${ts}`,
      amount_ht: "20.83",
      amount_tva: "4.17",
      amount_ttc: "25.00",
      tva_rate: "20",
      application_fee_amount: "2.50",
      seller_amount: "22.50",
      status: "succeeded",
    })
    .returning();

  // 8. Refund pending
  const [refund] = await db
    .insert(refundRequests)
    .values({
      order_id: order.id,
      payment_id: payment.id,
      requested_by: buyer.id,
      reason: "Test remboursement reel Stripe - produit endommage au deballage.",
      status: "pending",
      refund_amount: "25.00",
    })
    .returning();

  await db.insert(userSettings).values({ user_id: buyer.id }).onConflictDoNothing();
  await db.insert(userSettings).values({ user_id: seller.id }).onConflictDoNothing();

  console.log("\n=== RECAP ===");
  console.log(`Stripe PI    : ${paymentIntent.id}`);
  console.log(`Stripe Charge: ${chargeId}`);
  console.log(`Order BDD    : #${order.id}`);
  console.log(`Payment BDD  : #${payment.id}`);
  console.log(`Refund BDD   : #${refund.id} (pending, 25.00 EUR)`);
  console.log("\n=> Va dans /admin/refunds et approuve le refund !");
  console.log("=> Verifie sur https://dashboard.stripe.com/test/refunds");

  process.exit(0);
}

main().catch((e) => {
  console.error("ERREUR :", e);
  process.exit(1);
});

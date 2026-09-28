/**
 * Script de test end-to-end pour la facture PDF + Cloudinary + email.
 *
 * Usage :
 *   npx tsx scripts/test-invoice.ts
 *
 * Ce script :
 *   1. Crée (ou récupère) un buyer + un seller de test
 *   2. Crée une commande + 2 order_items
 *   3. Crée un paiement fake "succeeded"
 *   4. Appelle sendOrderConfirmationEmail(orderId)
 *   5. Vérifie que payments.invoice_url est rempli
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import {
  users,
  products,
  shops,
  orders,
  orderItems,
  payments,
} from "../src/core/db/schema";
import { sendOrderConfirmationEmail } from "../src/core/api/orders/orders.emails";

async function main() {
  console.log("🧪 Démarrage du test facture PDF\n");

  // ============================================================
  // 1. BUYER
  // ============================================================
  const buyerEmail = "test-buyer@anku-test.local";
  let [buyer] = await db
    .select()
    .from(users)
    .where(eq(users.email, buyerEmail))
    .limit(1);

  if (!buyer) {
    [buyer] = await db
      .insert(users)
      .values({
        first_name: "Test",
        last_name: "Buyer",
        email: buyerEmail,
        role: "particulier",
        provider: "local",
        email_verified: 1,
        stripe_account_status: "not_connected",
      })
      .returning();
    console.log(`✅ Buyer créé : #${buyer.id}`);
  } else {
    console.log(`ℹ️  Buyer existant : #${buyer.id}`);
  }

  // ============================================================
  // 2. SELLER
  // ============================================================
  const sellerEmail = "test-seller@anku-test.local";
  let [seller] = await db
    .select()
    .from(users)
    .where(eq(users.email, sellerEmail))
    .limit(1);

  if (!seller) {
    [seller] = await db
      .insert(users)
      .values({
        first_name: "Test",
        last_name: "Seller",
        email: sellerEmail,
        role: "professionnel",
        provider: "local",
        email_verified: 1,
        stripe_account_id: "acct_fake_test",
        stripe_account_status: "active",
      })
      .returning();
    console.log(`✅ Seller créé : #${seller.id}`);
  } else {
    console.log(`ℹ️  Seller existant : #${seller.id}`);
  }

  // ============================================================
  // 3. SHOP + PRODUITS
  // ============================================================
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: seller.id,
      name: "Boutique Test ANKU",
      city: "Paris",
    })
    .returning();

  const [product1] = await db
    .insert(products)
    .values({
      shop_id: shop.id,
      name: "Sac de randonnée 40L",
      price: "89.90",
      stock: 10,
    })
    .returning();

  const [product2] = await db
    .insert(products)
    .values({
      shop_id: shop.id,
      name: "Tente 2 places",
      price: "149.00",
      stock: 5,
    })
    .returning();

  console.log(`✅ Shop #${shop.id} + 2 produits créés`);

  // ============================================================
  // 4. COMMANDE
  // ============================================================
  const total = 89.9 * 2 + 149.0; // 2 sacs + 1 tente = 328.80

  const [order] = await db
    .insert(orders)
    .values({
      buyer_id: buyer.id,
      seller_id: seller.id,
      total_price: total.toFixed(2),
      status: "pending",
      delivery_method: "Colissimo",
      delivery_address: "12 rue de la Rando, 75011 Paris",
    })
    .returning();

  await db.insert(orderItems).values([
    {
      order_id: order.id,
      product_id: product1.id,
      quantity: 2,
      unit_price: "89.90",
    },
    {
      order_id: order.id,
      product_id: product2.id,
      quantity: 1,
      unit_price: "149.00",
    },
  ]);

  console.log(`✅ Commande #${order.id} créée (total ${total.toFixed(2)} €)`);

  // ============================================================
  // 5. PAIEMENT FAKE
  // ============================================================
  const feePercent = 2.5;
  const applicationFee = (total * (feePercent / 100)).toFixed(2);
  const sellerAmount = (total - Number(applicationFee)).toFixed(2);

  await db.insert(payments).values({
    order_id: order.id,
    user_id: buyer.id,
    seller_id: seller.id,
    seller_stripe_account_id: seller.stripe_account_id!,
    stripe_payment_intent: "pi_test_fake_12345",
    stripe_session_id: "cs_test_fake_12345",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: total.toFixed(2),
    tva_rate: "0",
    application_fee_amount: applicationFee,
    seller_amount: sellerAmount,
    status: "succeeded",
  });

  console.log(`✅ Paiement fake créé (commission ${applicationFee} €)`);

  // ============================================================
  // 6. ENVOI EMAIL + FACTURE
  // ============================================================
  console.log("\n📧 Appel sendOrderConfirmationEmail...\n");

  try {
    await sendOrderConfirmationEmail(order.id);
    console.log("\n✅ sendOrderConfirmationEmail OK");
  } catch (err) {
    console.error("\n❌ Erreur sendOrderConfirmationEmail :", err);
    process.exit(1);
  }

  // ============================================================
  // 7. VÉRIFICATION
  // ============================================================
  const [paymentAfter] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, order.id))
    .limit(1);

  console.log("\n=================== RÉSULTAT ===================");
  console.log(`Order ID          : ${order.id}`);
  console.log(`Invoice URL       : ${paymentAfter?.invoice_url ?? "❌ VIDE"}`);
  console.log(`Stripe PI         : ${paymentAfter?.stripe_payment_intent}`);
  console.log(`Commission ANKU   : ${paymentAfter?.application_fee_amount} €`);
  console.log(`Montant vendeur   : ${paymentAfter?.seller_amount} €`);
  console.log("===============================================");

  if (!paymentAfter?.invoice_url) {
    console.error("\n❌ La facture n'a PAS été uploadée sur Cloudinary");
    process.exit(1);
  }

  console.log("\n🎉 TEST RÉUSSI !");
  console.log(`👉 Ouvre la facture : ${paymentAfter.invoice_url}`);
  console.log(`👉 Vérifie la boîte mail : ${buyerEmail}`);
  console.log("\n⚠️  N'oublie pas : si Brevo refuse (IP non whitelistée),");
  console.log("    va sur https://app.brevo.com/security/authorised_ips");

  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Erreur fatale :", err);
  process.exit(1);
});
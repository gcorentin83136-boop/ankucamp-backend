/**
 * Test E2E Stripe : prépare tout pour payer une commande.
 *
 * Usage :
 *   npx tsx scripts/test-stripe-e2e.ts
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
} from "../src/core/db/schema";
import { stripe } from "../src/config/stripe";
import { createCheckoutSession } from "../src/core/api/payments/payments.service";

async function main() {
  console.log("🧪 Test E2E Stripe\n");

  // ============================================================
  // 1. BUYER
  // ============================================================
  const buyerEmail = process.env.TEST_BUYER_EMAIL;
  if (!buyerEmail) {
    console.error("❌ TEST_BUYER_EMAIL manquant dans .env");
    process.exit(1);
  }

  let [buyer] = await db
    .select()
    .from(users)
    .where(eq(users.email, buyerEmail))
    .limit(1);

  if (!buyer) {
    [buyer] = await db
      .insert(users)
      .values({
        first_name: "Client",
        last_name: "Test",
        email: buyerEmail,
        role: "particulier",
        provider: "local",
        email_verified: 1,
        stripe_account_status: "not_connected",
      })
      .returning();
    console.log(`✅ Buyer créé : #${buyer.id} (${buyerEmail})`);
  } else {
    console.log(`ℹ️  Buyer existant : #${buyer.id} (${buyerEmail})`);
  }

  // ============================================================
  // 2. SELLER + Stripe Connect
  // ============================================================
  const sellerEmail = "test-seller-stripe@anku-test.local";
  let [seller] = await db
    .select()
    .from(users)
    .where(eq(users.email, sellerEmail))
    .limit(1);

  if (!seller) {
    [seller] = await db
      .insert(users)
      .values({
        first_name: "Vendeur",
        last_name: "Test",
        email: sellerEmail,
        role: "professionnel",
        provider: "local",
        email_verified: 1,
      })
      .returning();
    console.log(`✅ Seller créé : #${seller.id}`);
  } else {
    console.log(`ℹ️  Seller existant : #${seller.id}`);
  }

  // Créer/récupérer le compte Stripe Connect
  if (!seller.stripe_account_id) {
    console.log("\n🏦 Création du compte Stripe Connect...");
    const account = await stripe.accounts.create({
      type: "express",
      country: "FR",
      email: seller.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { user_id: String(seller.id) },
    });

    await db
      .update(users)
      .set({
        stripe_account_id: account.id,
        stripe_account_status: "pending",
      })
      .where(eq(users.id, seller.id));

    seller.stripe_account_id = account.id;
    seller.stripe_account_status = "pending";

    console.log(`✅ Compte Connect créé : ${account.id}`);
  }

  // Vérifier le statut
  const account = await stripe.accounts.retrieve(seller.stripe_account_id!);
  console.log(`\n📊 Statut compte Connect :`);
  console.log(`   charges_enabled  : ${account.charges_enabled}`);
  console.log(`   payouts_enabled  : ${account.payouts_enabled}`);
  console.log(`   details_submitted: ${account.details_submitted}`);

  // ============================================================
  // 3. ONBOARDING si nécessaire
  // ============================================================
  if (!account.charges_enabled || !account.payouts_enabled) {
    console.log("\n⚠️  Le compte Connect n'est PAS encore activé.");
    console.log("   Il faut faire l'onboarding via ce lien :\n");

    const accountLink = await stripe.accountLinks.create({
      account: seller.stripe_account_id!,
      refresh_url: "http://localhost:3000/dashboard/stripe/refresh",
      return_url: "http://localhost:3000/dashboard/stripe/return",
      type: "account_onboarding",
    });

    console.log(`   👉 ${accountLink.url}\n`);
    console.log("   1. Ouvre cette URL dans ton navigateur");
    console.log("   2. Remplis avec les données de test Stripe :");
    console.log("      - Téléphone : 000 000 0000");
    console.log("      - Code SMS  : 000 000");
    console.log("      - SIRET     : 00000000000000");
    console.log("      - IBAN      : FR14 2004 1010 0505 0001 3M02 606");
    console.log("      - Identité  : Skip");
    console.log("   3. Une fois terminé, RELANCE ce script");
    process.exit(0);
  }

  console.log("✅ Compte Connect PRÊT\n");

  // Mettre à jour le statut en BDD
  await db
    .update(users)
    .set({ stripe_account_status: "active" })
    .where(eq(users.id, seller.id));

  // ============================================================
  // 4. SHOP + PRODUITS
  // ============================================================
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: seller.id,
      name: "Boutique E2E Stripe",
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
  // 5. COMMANDE
  // ============================================================
  const total = 89.9 * 2 + 149.0; // 328.80

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
  // 6. SESSION STRIPE CHECKOUT
  // ============================================================
  console.log("\n💳 Création de la session Stripe Checkout...");

  const { url, sessionId } = await createCheckoutSession(buyer.id, order.id);

  console.log(`✅ Session créée : ${sessionId}`);
  console.log("\n========================================================");
  console.log("👉 OUVRE CETTE URL DANS TON NAVIGATEUR :");
  console.log("========================================================");
  console.log(`\n${url}\n`);
  console.log("========================================================");
  console.log("\n📝 Carte de test :");
  console.log("   Numéro  : 4242 4242 4242 4242");
  console.log("   Date    : 12/34");
  console.log("   CVC     : 123");
  console.log("   Nom     : Test");
  console.log("   Pays    : France");
  console.log("   CP      : 75011");
  console.log(`\n📧 Après paiement, tu recevras un email sur : ${buyerEmail}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Erreur fatale :", err);
  process.exit(1);
});
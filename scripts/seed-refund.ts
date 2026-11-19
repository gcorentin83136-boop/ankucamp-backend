import bcrypt from "bcrypt";
import { db } from "../src/core/db";
import {
  users, userSettings, shops, products, orders, orderItems, payments, refundRequests,
} from "../src/core/db/schema";

async function main() {
  const ts = Date.now();
  const password_hash = await bcrypt.hash("Test1234!", 10);

  const [buyer] = await db.insert(users).values({
    first_name: "Jean", last_name: "Acheteur",
    username: `refundbuyer_${ts}`, email: `refundbuyer-${ts}@anku.local`,
    password_hash, role: "particulier", provider: "local", email_verified: 1,
  }).returning();

  const [seller] = await db.insert(users).values({
    first_name: "Marie", last_name: "Vendeuse",
    username: `refundseller_${ts}`, email: `refundseller-${ts}@anku.local`,
    password_hash, role: "professionnel", provider: "local",
    email_verified: 1, verification_status: "verified",
  }).returning();

  const [shop] = await db.insert(shops).values({
    owner_id: seller.id, name: `Ferme ${ts}`,
    description: "Ferme de test", city: "Lyon",
  }).returning();

  const [product] = await db.insert(products).values({
    shop_id: shop.id, name: "Panier de legumes",
    description: "Panier bio", price: "25.00", stock: 100, location: "Lyon",
  }).returning();

  const [order] = await db.insert(orders).values({
    buyer_id: buyer.id, seller_id: seller.id, status: "delivered",
    delivery_method: "pickup", total_price: "25.00",
  }).returning();

  await db.insert(orderItems).values({
    order_id: order.id, product_id: product.id, quantity: 1, unit_price: "25.00",
  });

  // Récupère le payment_id (nécessaire pour refund_requests)
  const [payment] = await db.insert(payments).values({
    order_id: order.id,
    user_id: buyer.id,
    seller_id: seller.id,
    stripe_payment_intent: `pi_test_${ts}`,
    stripe_session_id: `cs_test_${ts}`,
    amount_ht: "20.83",
    amount_tva: "4.17",
    amount_ttc: "25.00",
    tva_rate: "20",
    application_fee_amount: "2.50",
    seller_amount: "22.50",
    status: "succeeded",
  }).returning();

  const [refund] = await db.insert(refundRequests).values({
    order_id: order.id,
    payment_id: payment.id,
    requested_by: buyer.id,
    reason: "Produit recu endommage, plusieurs legumes etaient abimes au deballage.",
    status: "pending",
    refund_amount: "25.00",
  }).returning();

  await db.insert(userSettings).values({ user_id: buyer.id }).onConflictDoNothing();
  await db.insert(userSettings).values({ user_id: seller.id }).onConflictDoNothing();

  console.log(`Refund #${refund.id} cree (pending, 25.00 EUR)`);
  console.log(`Payment : #${payment.id}`);
  console.log(`Buyer   : ${buyer.email}`);
  console.log(`Seller  : ${seller.email}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/core/db";
import { payments } from "../src/core/db/schema";
import { sendOrderConfirmationEmail } from "../src/core/api/orders/orders.emails";

async function main() {
  const ORDER_ID = 11;

  // Reset invoice_url pour forcer la regénération
  await db
    .update(payments)
    .set({ invoice_url: null })
    .where(eq(payments.order_id, ORDER_ID));

  console.log(`🔄 invoice_url reset pour commande #${ORDER_ID}`);

  // Renvoie l'email acheteur + facture + email vendeur
  await sendOrderConfirmationEmail(ORDER_ID);

  console.log("✅ Terminé");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});
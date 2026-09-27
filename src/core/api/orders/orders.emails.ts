import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orders, orderItems, products, users, payments } from "../../db/schema";
import { sendEmail } from "../../emails/email.service";
import { orderConfirmationTemplate } from "../../emails/templates/orderConfirmation";
import { generateInvoicePdf, generateInvoiceNumber } from "../../emails/invoice";
import { env } from "../../../config/env";

/**
 * Envoie l'email de confirmation de commande avec la facture PDF en pièce jointe.
 * Appelé après un paiement Stripe réussi (webhook).
 */
export async function sendOrderConfirmationEmail(orderId: number): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    console.error("sendOrderConfirmationEmail: commande introuvable", orderId);
    return;
  }

  const [buyer] = await db
    .select()
    .from(users)
    .where(eq(users.id, order.buyer_id))
    .limit(1);

  const [seller] = await db
    .select()
    .from(users)
    .where(eq(users.id, order.seller_id))
    .limit(1);

  if (!buyer || !seller) {
    console.error("sendOrderConfirmationEmail: buyer/seller introuvable");
    return;
  }

  const items = await db
    .select({
      productName: products.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unit_price,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(eq(orderItems.order_id, orderId));

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  const invoiceNumber = generateInvoiceNumber(orderId);
  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber,
    orderId: order.id,
    date: new Date(),
    buyerName: `${buyer.first_name} ${buyer.last_name}`,
    buyerEmail: buyer.email,
    sellerName: `${seller.first_name} ${seller.last_name}`,
    sellerEmail: seller.email,
    items: items.map((i) => ({
      productName: i.productName ?? "Produit",
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    totalPrice: order.total_price,
    deliveryMethod: order.delivery_method,
    deliveryAddress: order.delivery_address,
    paymentIntentId: payment?.stripe_payment_intent ?? "N/A",
    applicationFeeAmount: payment?.application_fee_amount ?? "0",
    sellerAmount: payment?.seller_amount ?? order.total_price,
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
  });

  const { subject, htmlContent, textContent } = orderConfirmationTemplate({
    buyerFirstName: buyer.first_name,
    orderId: order.id,
    totalPrice: order.total_price,
    deliveryMethod: order.delivery_method,
    deliveryAddress: order.delivery_address,
    items: items.map((i) => ({
      productName: i.productName ?? "Produit",
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    sellerName: `${seller.first_name} ${seller.last_name}`,
  });

  await sendEmail({
    to: buyer.email,
    toName: buyer.first_name,
    subject,
    htmlContent,
    textContent,
    attachments: [
      {
        name: `facture-${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  console.log(`📧 Email confirmation commande #${orderId} envoyé à ${buyer.email}`);
}
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orders, orderItems, products, users, payments } from "../../db/schema";
import { sendEmail } from "../../emails/email.service";
import { orderConfirmationTemplate } from "../../emails/templates/orderConfirmation";
import { sellerNewOrderTemplate } from "../../emails/templates/sellerNewOrder";
import { generateInvoicePdf, generateInvoiceNumber } from "../../emails/invoice";
import { env } from "../../../config/env";
import { cloudinary } from "../../../config/cloudinary";

// ============================================================
// UPLOAD CLOUDINARY
// ============================================================

function uploadPdfToCloudinary(
  buffer: Buffer,
  publicId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw", // ← IMPORTANT pour PDF
        folder: "anku/invoices",
        public_id: publicId,
        format: "pdf",
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error("Cloudinary: résultat vide"));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// ============================================================
// ENVOI EMAIL + FACTURE
// ============================================================

/**
 * Envoie l'email de confirmation de commande avec la facture PDF en pièce jointe.
 * Upload aussi la facture sur Cloudinary et stocke l'URL dans payments.invoice_url.
 * Envoie également un email de notification au vendeur.
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

  const itemsMapped = items.map((i) => ({
    productName: i.productName ?? "Produit",
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));

  // ============================================================
  // 1. Génération du PDF en mémoire
  // ============================================================
  const invoiceNumber = generateInvoiceNumber(orderId);
  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber,
    orderId: order.id,
    date: new Date(),
    buyerName: `${buyer.first_name} ${buyer.last_name}`,
    buyerEmail: buyer.email,
    sellerName: `${seller.first_name} ${seller.last_name}`,
    sellerEmail: seller.email,
    items: itemsMapped,
    totalPrice: order.total_price,
    deliveryMethod: order.delivery_method,
    deliveryAddress: order.delivery_address,
    paymentIntentId: payment?.stripe_payment_intent ?? "N/A",
    applicationFeeAmount: payment?.application_fee_amount ?? "0",
    sellerAmount: payment?.seller_amount ?? order.total_price,
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
  });

  // ============================================================
  // 2. Upload Cloudinary (n'échoue pas l'envoi email si erreur)
  // ============================================================
  try {
    const invoiceUrl = await uploadPdfToCloudinary(
      pdfBuffer,
      `facture-${invoiceNumber}`
    );

    if (payment) {
      await db
        .update(payments)
        .set({ invoice_url: invoiceUrl })
        .where(eq(payments.order_id, orderId));
      console.log(`☁️  Facture uploadée sur Cloudinary : ${invoiceUrl}`);
    }
  } catch (err) {
    console.error("❌ Erreur upload Cloudinary facture:", err);
  }

  // ============================================================
  // 3. Email ACHETEUR : confirmation + facture PDF
  // ============================================================
  const buyerTpl = orderConfirmationTemplate({
    buyerFirstName: buyer.first_name,
    orderId: order.id,
    totalPrice: order.total_price,
    deliveryMethod: order.delivery_method,
    deliveryAddress: order.delivery_address,
    items: itemsMapped,
    sellerName: `${seller.first_name} ${seller.last_name}`,
  });

  await sendEmail({
    to: buyer.email,
    toName: buyer.first_name,
    subject: buyerTpl.subject,
    htmlContent: buyerTpl.htmlContent,
    textContent: buyerTpl.textContent,
    attachments: [
      {
        name: `facture-${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  console.log(`📧 Email confirmation commande #${orderId} envoyé à ${buyer.email}`);

  // ============================================================
  // 4. Email VENDEUR : nouvelle commande
  // ============================================================
  try {
    const sellerTpl = sellerNewOrderTemplate({
      sellerFirstName: seller.first_name,
      orderId: order.id,
      totalPrice: order.total_price,
      sellerAmount: payment?.seller_amount ?? order.total_price,
      applicationFeeAmount: payment?.application_fee_amount ?? "0",
      platformFeePercent: env.PLATFORM_FEE_PERCENT,
      buyerName: `${buyer.first_name} ${buyer.last_name}`,
      buyerEmail: buyer.email,
      deliveryMethod: order.delivery_method,
      deliveryAddress: order.delivery_address,
      items: itemsMapped,
    });

    await sendEmail({
      to: seller.email,
      toName: seller.first_name,
      subject: sellerTpl.subject,
      htmlContent: sellerTpl.htmlContent,
      textContent: sellerTpl.textContent,
    });

    console.log(
      `📧 Email nouvelle commande #${orderId} envoyé au vendeur ${seller.email}`
    );
  } catch (err) {
    // On ne bloque PAS le flux si l'email vendeur échoue
    console.error("❌ Erreur envoi email vendeur:", err);
  }
}
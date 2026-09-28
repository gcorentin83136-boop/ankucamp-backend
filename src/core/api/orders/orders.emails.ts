import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orders, orderItems, products, users, payments } from "../../db/schema";
import { sendEmail } from "../../emails/email.service";
import { orderConfirmationTemplate } from "../../emails/templates/orderConfirmation";
import { sellerNewOrderTemplate } from "../../emails/templates/sellerNewOrder";
import { invoiceResentTemplate } from "../../emails/templates/invoiceResent";
import { orderShippedTemplate } from "../../emails/templates/orderShipped";
import { orderDeliveredTemplate } from "../../emails/templates/orderDelivered";
import { orderCancelledTemplate } from "../../emails/templates/orderCancelled";
import { generateInvoicePdf, generateInvoiceNumber } from "../../emails/invoice";
import { env } from "../../../config/env";
import { cloudinary } from "../../../config/cloudinary";
import { AppError } from "../../errors/AppError";

// ============================================================
// UPLOAD / DOWNLOAD CLOUDINARY
// ============================================================

function uploadPdfToCloudinary(
  buffer: Buffer,
  publicId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
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

async function downloadInvoiceFromCloudinary(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new AppError(
      `Impossible de récupérer la facture (${response.status})`,
      500
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================
// EMAIL CONFIRMATION + FACTURE (appelé par le webhook)
// ============================================================

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

  // 1. Génération du PDF
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

  // 2. Upload Cloudinary
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

  // 3. Email ACHETEUR
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

  // 4. Email VENDEUR
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
    console.error("❌ Erreur envoi email vendeur:", err);
  }
}

// ============================================================
// RENVOI FACTURE (feature "1 clic" depuis Mes commandes)
// ============================================================

/**
 * Renvoie la facture PDF ORIGINALE (depuis Cloudinary) à un destinataire.
 * Utilisé par l'endpoint POST /orders/:id/invoice/resend.
 */
export async function resendInvoiceEmail(
  orderId: number,
  recipientEmail: string,
  recipientFirstName: string
): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new AppError("Commande introuvable", 404);
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (!payment || !payment.invoice_url) {
    throw new AppError(
      "La facture n'est pas disponible pour cette commande (commande non payée)",
      400
    );
  }

  // 1. Télécharger le PDF ORIGINAL depuis Cloudinary
  const pdfBuffer = await downloadInvoiceFromCloudinary(payment.invoice_url);

  const invoiceNumber = generateInvoiceNumber(orderId);

  // 2. Template email dédié "renvoi de facture"
  const tpl = invoiceResentTemplate({
    recipientFirstName,
    orderId: order.id,
    invoiceNumber,
  });

  // 3. Envoi avec pièce jointe
  await sendEmail({
    to: recipientEmail,
    toName: recipientFirstName,
    subject: tpl.subject,
    htmlContent: tpl.htmlContent,
    textContent: tpl.textContent,
    attachments: [
      {
        name: `facture-${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  console.log(
    `📧 Facture #${invoiceNumber} renvoyée à ${recipientEmail} (commande #${orderId})`
  );
}

// ============================================================
// NOTIFICATION CHANGEMENT DE STATUT COMMANDE
// ============================================================

/**
 * Envoie un email au buyer selon le nouveau statut de la commande.
 * Appelé depuis updateOrderStatus() quand le vendeur change le statut.
 *
 * Statuts déclencheurs : shipped, delivered, cancelled
 * Statuts ignorés : pending, confirmed (déjà couverts par orderConfirmation)
 */
export async function sendOrderStatusEmail(
  orderId: number,
  newStatus: string
): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    console.error("sendOrderStatusEmail: commande introuvable", orderId);
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
    console.error("sendOrderStatusEmail: buyer/seller introuvable");
    return;
  }

  const sellerName = `${seller.first_name} ${seller.last_name}`;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  let tpl: { subject: string; htmlContent: string; textContent: string };

  switch (newStatus) {
    case "shipped":
      tpl = orderShippedTemplate({
        buyerFirstName: buyer.first_name,
        orderId: order.id,
        sellerName,
        deliveryMethod: order.delivery_method,
        trackingNumber: order.tracking_number,
      });
      break;

    case "delivered":
      tpl = orderDeliveredTemplate({
        buyerFirstName: buyer.first_name,
        orderId: order.id,
        sellerName,
      });
      break;

    case "cancelled":
      tpl = orderCancelledTemplate({
        buyerFirstName: buyer.first_name,
        orderId: order.id,
        sellerName,
        totalPrice: order.total_price,
        wasPaid: payment?.status === "succeeded",
      });
      break;

    default:
      // Pas d'email pour pending/confirmed
      return;
  }

  await sendEmail({
    to: buyer.email,
    toName: buyer.first_name,
    subject: tpl.subject,
    htmlContent: tpl.htmlContent,
    textContent: tpl.textContent,
  });

  console.log(
    `📧 Email statut "${newStatus}" commande #${orderId} envoyé à ${buyer.email}`
  );
}
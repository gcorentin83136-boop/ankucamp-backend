import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createOrderSchema, updateStatusSchema } from "./orders.validation";
import {
  getOrdersByBuyer,
  getOrdersBySeller,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  resendInvoiceService,
} from "./orders.service";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  orders,
  orderItems,
  payments,
  products,
  users,
} from "../../db/schema";
import {
  generateInvoicePdf,
  generateInvoiceNumber,
} from "../../emails/invoice";

// ============================================================
// LISTE
// ============================================================

export async function listMyOrders(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getOrdersByBuyer(req.user.id);
  return res.json({ success: true, orders: list });
}

export async function listSellerOrders(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getOrdersBySeller(req.user.id);
  return res.json({ success: true, orders: list });
}

// ============================================================
// LECTURE
// ============================================================

export async function getOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  const order = await getOrderById(id);
  if (!order) throw new AppError("Commande introuvable", 404);

  if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
    throw new AppError("Accès interdit", 403);
  }

  return res.json({ success: true, order });
}

// ============================================================
// CRÉATION
// ============================================================

export async function createOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const order = await createOrder(req.user.id, parsed.data);

  return res.status(201).json({ success: true, message: "Commande créée", order });
}

// ============================================================
// MISE À JOUR STATUT
// ============================================================

export async function updateStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const order = await updateOrderStatus(
    id,
    req.user.id,
    parsed.data.status,
    parsed.data.tracking_number
  );

  return res.json({ success: true, message: "Statut mis à jour", order });
}

// ============================================================
// SUPPRESSION
// ============================================================

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  await deleteOrder(id, req.user.id);
  return res.status(204).send();
}

// ============================================================
// 📄 TÉLÉCHARGEMENT FACTURE PDF
// ============================================================

/**
 * GET /orders/:id/invoice
 * Redirige vers la facture PDF stockée sur Cloudinary.
 */
export async function downloadInvoice(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const orderId = Number(req.params.id);
  if (isNaN(orderId) || orderId <= 0) {
    throw new AppError("ID commande invalide", 400);
  }

  // 1. Commande
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new AppError("Commande introuvable", 404);

  if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
    throw new AppError("Vous n'avez pas accès à cette facture", 403);
  }

  // 2. Paiement (s'assure que la commande est payée)
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (!payment) {
    throw new AppError("Facture non disponible (commande non payée)", 404);
  }

  // 3. Articles + produits
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.order_id, orderId));

  const productIds = [...new Set(items.map((i) => i.product_id))];
  const productsFound =
    productIds.length > 0
      ? await db
          .select({ id: products.id, name: products.name })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];

  const productsMap = new Map(productsFound.map((p) => [p.id, p]));

  // 4. Buyer + Seller
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

  // 5. Calculs financiers
  const totalPrice = Number(order.total_price);
  const feeAmount = payment.application_fee_amount
    ? Number(payment.application_fee_amount)
    : 0;
  const sellerAmount = payment.seller_amount
    ? Number(payment.seller_amount)
    : totalPrice - feeAmount;
  const platformFeePercent =
    totalPrice > 0 ? Math.round((feeAmount / totalPrice) * 1000) / 10 : 0;

  // 6. Génération PDF
  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber: generateInvoiceNumber(orderId),
    orderId,
    date: order.created_at ? new Date(order.created_at) : new Date(),
    buyerName: buyer
      ? `${buyer.first_name} ${buyer.last_name}`.trim()
      : `Acheteur #${order.buyer_id}`,
    buyerEmail: buyer?.email ?? "—",
    sellerName: seller
      ? `${seller.first_name} ${seller.last_name}`.trim()
      : `Vendeur #${order.seller_id}`,
    sellerEmail: seller?.email ?? "—",
    sellerAddress: seller?.address ?? null,
    items: items.map((i) => ({
      productName:
        productsMap.get(i.product_id)?.name ?? `Produit #${i.product_id}`,
      quantity: i.quantity,
      unitPrice: i.unit_price,
    })),
    totalPrice: order.total_price,
    deliveryMethod:
      order.delivery_method === "pickup"
        ? "Retrait sur place"
        : order.delivery_method === "shipping"
        ? "Livraison"
        : order.delivery_method,
    deliveryAddress: order.delivery_address,
    paymentIntentId: payment.stripe_payment_intent,
    applicationFeeAmount: feeAmount.toFixed(2),
    sellerAmount: sellerAmount.toFixed(2),
    platformFeePercent,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="facture-anku-${orderId}.pdf"`
  );
  res.setHeader("Content-Length", pdfBuffer.length.toString());
  res.setHeader("Cache-Control", "private, no-store");

  return res.send(pdfBuffer);
}

// ============================================================
// 📧 RENVOI FACTURE PAR EMAIL
// ============================================================

/**
 * POST /orders/:id/invoice/resend
 * Renvoie la facture PDF par email.
 * - Acheteur : reçoit la facture à sa propre adresse
 * - Vendeur  : envoie la facture à l'acheteur
 */
export async function resendInvoice(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const orderId = Number(req.params.id);
  if (isNaN(orderId) || orderId <= 0) {
    throw new AppError("ID commande invalide", 400);
  }

  const result = await resendInvoiceService(orderId, req.user.id);

  return res.json({
    success: true,
    message: `Facture envoyée à ${result.sentTo}`,
    sentTo: result.sentTo,
    invoiceNumber: result.invoiceNumber,
  });
}
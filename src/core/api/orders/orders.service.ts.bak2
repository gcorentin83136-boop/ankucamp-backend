import { eq, ne, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import { orders, orderItems, products, payments, users, shops } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { sendOrderStatusEmail } from "./orders.emails";
import { sendEmail } from "../../emails/email.service";
import { generateInvoicePdf, generateInvoiceNumber } from "../../emails/invoice";
import { invoiceResentTemplate } from "../../emails/templates/invoiceResent";
import {
  notifyOrderShipped,
  notifyOrderDelivered,
  notifyOrderCancelled,
} from "../../notifications/notifications.helper";
import { isShopHidden, isShopOnVacation } from "../settings/shop/shop.service";
import type { CreateOrderInput } from "./orders.validation";

// ============================================================
// LECTURE
// ============================================================

export async function getOrdersByBuyer(buyerId: number) {
  const buyerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.buyer_id, buyerId));

  if (buyerOrders.length === 0) return [];

  const orderIds = buyerOrders.map((o) => o.id);
  const sellerIds = [...new Set(buyerOrders.map((o) => o.seller_id))];

  const [items, sellers, sellerShops] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.order_id, orderIds)),
    db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        username: users.username,
        avatar_url: users.avatar_url,
        verification_status: users.verification_status,
      })
      .from(users)
      .where(inArray(users.id, sellerIds)),
    db
      .select({
        id: shops.id,
        name: shops.name,
        slug: shops.slug,
        logo_url: shops.logo_url,
        owner_id: shops.owner_id,
      })
      .from(shops)
      .where(inArray(shops.owner_id, sellerIds)),
  ]);

  // Recuperer les produits concernes
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const productsFound =
    productIds.length > 0
      ? await db
          .select({
            id: products.id,
            name: products.name,
            image_url: products.image_url,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];

  const productsMap = new Map(productsFound.map((p) => [p.id, p]));
  const sellersMap = new Map(sellers.map((s) => [s.id, s]));
  const shopsMap = new Map(sellerShops.map((s) => [s.owner_id, s]));

  return buyerOrders.map((order) => ({
    ...order,
    seller: sellersMap.get(order.seller_id) ?? null,
    shop: shopsMap.get(order.seller_id) ?? null,
    items: items
      .filter((i) => i.order_id === order.id)
      .map((i) => ({
        ...i,
        product: productsMap.get(i.product_id) ?? null,
      })),
  }));
}

export async function getOrdersBySeller(sellerId: number) {
  const sellerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.seller_id, sellerId));

  if (sellerOrders.length === 0) return [];

  const orderIds = sellerOrders.map((o) => o.id);
  const buyerIds = [...new Set(sellerOrders.map((o) => o.buyer_id))];

  const [items, buyers] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.order_id, orderIds)),
    db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(users)
      .where(inArray(users.id, buyerIds)),
  ]);

  const productIds = [...new Set(items.map((i) => i.product_id))];
  const productsFound =
    productIds.length > 0
      ? await db
          .select({
            id: products.id,
            name: products.name,
            image_url: products.image_url,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];

  const productsMap = new Map(productsFound.map((p) => [p.id, p]));
  const buyersMap = new Map(buyers.map((b) => [b.id, b]));

  return sellerOrders.map((order) => ({
    ...order,
    buyer: buyersMap.get(order.buyer_id) ?? null,
    items: items
      .filter((i) => i.order_id === order.id)
      .map((i) => ({
        ...i,
        product: productsMap.get(i.product_id) ?? null,
      })),
  }));
}

export async function getOrderById(id: number) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) return null;

  const [items, buyerRows] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(eq(orderItems.order_id, id)),
    db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(users)
      .where(eq(users.id, order.buyer_id))
      .limit(1),
  ]);

  const productIds = [...new Set(items.map((i) => i.product_id))];
  const productsFound =
    productIds.length > 0
      ? await db
          .select({
            id: products.id,
            name: products.name,
            image_url: products.image_url,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];

  const productsMap = new Map(productsFound.map((p) => [p.id, p]));

  return {
    ...order,
    buyer: buyerRows[0] ?? null,
    items: items.map((i) => ({
      ...i,
      product: productsMap.get(i.product_id) ?? null,
    })),
  };
}

// ============================================================
// CRÉATION (avec blocage vacances / boutique masquée)
// ============================================================

export async function createOrder(buyerId: number, input: CreateOrderInput) {
  const { seller_id, delivery_method, delivery_address, items } = input;

  if (buyerId === seller_id) {
    throw new AppError("Vous ne pouvez pas commander chez vous-même", 400);
  }

  const productIds = items.map((i) => i.product_id);

  const productsFound = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));

  if (productsFound.length !== productIds.length) {
    throw new AppError("Un ou plusieurs produits sont introuvables", 404);
  }

  // ============================================================
  // Vérification : boutiques masquées ou en vacances
  // ============================================================
  const shopIds = [...new Set(productsFound.map((p) => p.shop_id))];

  for (const shopId of shopIds) {
    const hidden = await isShopHidden(shopId);
    if (hidden) {
      throw new AppError(
        "Impossible de commander : une des boutiques est temporairement indisponible",
        403
      );
    }

    const onVacation = await isShopOnVacation(shopId);
    if (onVacation) {
      throw new AppError(
        "Impossible de commander : une des boutiques est actuellement en vacances",
        403
      );
    }
  }

  let totalPrice = 0;
  const itemsToInsert: Array<{
    product_id: number;
    quantity: number;
    unit_price: string;
  }> = [];

  for (const item of items) {
    const product = productsFound.find((p) => p.id === item.product_id)!;

    if (product.stock !== null && product.stock < item.quantity) {
      throw new AppError(
        `Stock insuffisant pour "${product.name}" (disponible : ${product.stock})`,
        400
      );
    }

    const unitPrice = Number(product.price);
    totalPrice += unitPrice * item.quantity;

    itemsToInsert.push({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: product.price,
    });
  }

  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        buyer_id: buyerId,
        seller_id,
        total_price: totalPrice.toFixed(2),
        status: "pending",
        delivery_method,
        delivery_address: delivery_address ?? null,
      })
      .returning();

    await tx.insert(orderItems).values(
      itemsToInsert.map((i) => ({ ...i, order_id: order.id }))
    );

    for (const item of items) {
      const product = productsFound.find((p) => p.id === item.product_id)!;
      if (product.stock !== null) {
        await tx
          .update(products)
          .set({ stock: product.stock - item.quantity })
          .where(eq(products.id, item.product_id));
      }
    }

    return order;
  });

  return getOrderById(result.id);
}

// ============================================================
// STATUT
// ============================================================

export async function updateOrderStatus(
  orderId: number,
  userId: number,
  newStatus: string,
  trackingNumber?: string | null
) {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new AppError("Commande introuvable", 404);
  }

  const isSeller = order.seller_id === userId;
  const isBuyer = order.buyer_id === userId;

  if (!isSeller && !isBuyer) {
    throw new AppError("Vous n'avez pas accès à cette commande", 403);
  }

  if (newStatus === "cancelled") {
    if (!isBuyer) {
      throw new AppError("Seul l'acheteur peut annuler une commande", 403);
    }
    if (order.status !== "pending") {
      throw new AppError(
        "Impossible d'annuler : la commande n'est plus en attente",
        400
      );
    }
  } else {
    if (!isSeller) {
      throw new AppError(
        "Seul le vendeur peut modifier le statut de la commande",
        403
      );
    }
  }

  const updates: {
    status: string;
    tracking_number?: string | null;
    delivered_at?: Date;
  } = {
    status: newStatus,
  };

  // 🔒 Anti-doublon : un même n° de suivi ne peut pas être utilisé 2 fois
  if (newStatus === "shipped" && trackingNumber) {
    const [existing] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.tracking_number, trackingNumber),
          ne(orders.id, orderId)
        )
      )
      .limit(1);

    if (existing) {
      throw new AppError(
        `Ce numéro de suivi est déjà utilisé par la commande #${existing.id}`,
        409
      );
    }
  }

  if (newStatus === "shipped" && trackingNumber !== undefined) {
    updates.tracking_number = trackingNumber;
  }

  if (newStatus === "delivered") {
    updates.delivered_at = new Date();
  }

  const [updated] = await db
    .update(orders)
    .set(updates)
    .where(eq(orders.id, orderId))
    .returning();

  // 📧 Email au buyer
  if (["shipped", "delivered", "cancelled"].includes(newStatus)) {
    sendOrderStatusEmail(orderId, newStatus).catch((err) =>
      console.error("❌ Erreur envoi email statut:", err)
    );
  }

  // 🔔 Notifications in-app
  try {
    switch (newStatus) {
      case "shipped":
        await notifyOrderShipped(
          order.buyer_id,
          orderId,
          updates.tracking_number ?? order.tracking_number
        );
        break;

      case "delivered":
        await notifyOrderDelivered(order.buyer_id, orderId);
        break;

      case "cancelled":
        await notifyOrderCancelled(order.seller_id, orderId);
        break;
    }
  } catch (err) {
    console.error("❌ Erreur notification changement statut:", err);
  }

  return updated;
}

// ============================================================
// SUPPRESSION
// ============================================================

export async function deleteOrder(orderId: number, userId: number) {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new AppError("Commande introuvable", 404);
  }

  if (order.buyer_id !== userId) {
    throw new AppError("Seul l'acheteur peut supprimer cette commande", 403);
  }

  if (order.status !== "pending") {
    throw new AppError(
      "Impossible de supprimer : la commande n'est plus en attente",
      400
    );
  }

  await db.delete(orderItems).where(eq(orderItems.order_id, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));
}

// ============================================================
// RENVOI FACTURE (feature "1 clic")
// ============================================================

export async function resendInvoiceService(
  orderId: number,
  userId: number
): Promise<{ sentTo: string; invoiceNumber: string }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new AppError("Commande introuvable", 404);
  }

  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw new AppError("Vous n'avez pas accès à cette facture", 403);
  }

  // Payment requis (commande payée)
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.order_id, orderId))
    .limit(1);

  if (!payment) {
    throw new AppError(
      "Aucun paiement trouvé pour cette commande — impossible de générer la facture",
      400
    );
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
    throw new AppError("Acheteur ou vendeur introuvable", 404);
  }

  // Items + produits
  const items = await db
    .select({
      productName: products.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unit_price,
    })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.product_id))
    .where(eq(orderItems.order_id, orderId));

  const itemsMapped = items.map((i) => ({
    productName: i.productName ?? "Produit",
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));

  // Génération PDF
  const invoiceNumber = generateInvoiceNumber(orderId);
  const totalPrice = Number(order.total_price);
  const feeAmount = payment.application_fee_amount
    ? Number(payment.application_fee_amount)
    : 0;
  const sellerAmount = payment.seller_amount
    ? Number(payment.seller_amount)
    : totalPrice - feeAmount;
  const platformFeePercent =
    totalPrice > 0 ? Math.round((feeAmount / totalPrice) * 1000) / 10 : 0;

  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber,
    orderId: order.id,
    date: order.created_at ? new Date(order.created_at) : new Date(),
    buyerName: `${buyer.first_name} ${buyer.last_name}`.trim(),
    buyerEmail: buyer.email,
    sellerName: `${seller.first_name} ${seller.last_name}`.trim(),
    sellerEmail: seller.email,
    sellerAddress: seller.address ?? null,
    items: itemsMapped,
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

  // Template email
  const tpl = invoiceResentTemplate({
    recipientFirstName: buyer.first_name,
    orderId: order.id,
    invoiceNumber,
  });

  // Envoi email avec PDF en pièce jointe (base64)
  await sendEmail({
    to: buyer.email,
    toName: `${buyer.first_name} ${buyer.last_name}`.trim(),
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

  return {
    sentTo: buyer.email,
    invoiceNumber,
  };
}
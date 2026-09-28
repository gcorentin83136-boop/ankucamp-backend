import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { orders, orderItems, products, payments, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { generateInvoiceNumber } from "../../emails/invoice";
import { resendInvoiceEmail, sendOrderStatusEmail } from "./orders.emails";
import {
  notifyOrderShipped,
  notifyOrderDelivered,
  notifyOrderCancelled,
} from "../../notifications/notifications.helper";
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

  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.order_id, orderIds));

  return buyerOrders.map((order) => ({
    ...order,
    items: items.filter((i) => i.order_id === order.id),
  }));
}

export async function getOrdersBySeller(sellerId: number) {
  const sellerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.seller_id, sellerId));

  if (sellerOrders.length === 0) return [];

  const orderIds = sellerOrders.map((o) => o.id);

  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.order_id, orderIds));

  return sellerOrders.map((order) => ({
    ...order,
    items: items.filter((i) => i.order_id === order.id),
  }));
}

export async function getOrderById(id: number) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.order_id, id));

  return { ...order, items };
}

// ============================================================
// CRÉATION
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

  // Prépare les champs à mettre à jour
  const updates: {
    status: string;
    tracking_number?: string | null;
    delivered_at?: Date;
  } = {
    status: newStatus,
  };

  // Si on passe à "shipped" et qu'un tracking_number est fourni, on le stocke
  if (newStatus === "shipped" && trackingNumber !== undefined) {
    updates.tracking_number = trackingNumber;
  }

  // Si on passe à "delivered", on enregistre la date (utile pour scheduler J+3)
  if (newStatus === "delivered") {
    updates.delivered_at = new Date();
  }

  const [updated] = await db
    .update(orders)
    .set(updates)
    .where(eq(orders.id, orderId))
    .returning();

  // ============================================================
  // 📧 Email au buyer (fire & forget)
  // ============================================================
  if (["shipped", "delivered", "cancelled"].includes(newStatus)) {
    sendOrderStatusEmail(orderId, newStatus).catch((err) =>
      console.error("❌ Erreur envoi email statut:", err)
    );
  }

  // ============================================================
  // 🔔 Notifications in-app (fire & forget)
  // ============================================================
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

/**
 * Renvoie la facture PDF de la commande à un destinataire selon le rôle.
 *
 * Règles :
 * - L'ACHETEUR peut se renvoyer la facture à lui-même
 * - Le VENDEUR peut envoyer la facture à l'acheteur
 * - Dans tous les cas, le destinataire final est l'ACHETEUR (buyer)
 * - Bloqué si la commande n'a pas été payée (pas d'invoice_url)
 */
export async function resendInvoiceService(
  orderId: number,
  userId: number
): Promise<{ sentTo: string; invoiceNumber: string }> {
  // 1. Charger la commande
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new AppError("Commande introuvable", 404);
  }

  // 2. Vérifier que l'utilisateur est buyer OU seller
  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw new AppError("Vous n'avez pas accès à cette facture", 403);
  }

  // 3. Vérifier que la commande est payée
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

  // 4. Charger l'acheteur (destinataire final dans tous les cas)
  const [buyer] = await db
    .select()
    .from(users)
    .where(eq(users.id, order.buyer_id))
    .limit(1);

  if (!buyer) {
    throw new AppError("Acheteur introuvable", 404);
  }

  // 5. Envoyer la facture à l'acheteur
  await resendInvoiceEmail(order.id, buyer.email, buyer.first_name);

  const invoiceNumber = generateInvoiceNumber(order.id);

  return {
    sentTo: buyer.email,
    invoiceNumber,
  };
}
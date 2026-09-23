import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { orders, orderItems, products } from "../../db/schema";
import { AppError } from "../../errors/AppError";
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
  newStatus: string
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

  const [updated] = await db
    .update(orders)
    .set({ status: newStatus })
    .where(eq(orders.id, orderId))
    .returning();

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
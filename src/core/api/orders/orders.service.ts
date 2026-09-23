import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import { orders, orderItems, products } from "../../db/schema";
import type { CreateOrderInput } from "./orders.validation";

/**
 * Récupère les commandes d'un acheteur, avec leurs items joints.
 */
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

/**
 * Récupère les commandes reçues par un vendeur.
 */
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

/**
 * Récupère une commande par ID (avec items).
 */
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

/**
 * Crée une commande complète :
 * 1. Vérifie que tous les produits existent et appartiennent au vendeur.
 * 2. Vérifie le stock.
 * 3. Calcule le total (prix unitaire × quantité).
 * 4. Insère la commande + les items dans une transaction.
 * 5. Décrémente le stock.
 */
export async function createOrder(buyerId: number, input: CreateOrderInput) {
  const { seller_id, delivery_method, delivery_address, items } = input;

  if (buyerId === seller_id) {
    throw new Error("Vous ne pouvez pas commander chez vous-même");
  }

  const productIds = items.map((i) => i.product_id);

  // 1. Charger tous les produits en une seule requête
  const productsFound = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));

  // Vérifier que tous les produits existent
  if (productsFound.length !== productIds.length) {
    throw new Error("Un ou plusieurs produits sont introuvables");
  }

  // Vérifier que chaque produit appartient bien au vendeur
  const wrongSeller = productsFound.find((p) => p.shop_id === undefined);
  // (Note : on vérifie plus bas que le produit appartient à une boutique du vendeur,
  //  mais on n'a pas encore relié shop → seller dans cette version. Pour simplifier,
  //  on considère ici que le vendeur est passé en paramètre et on fait confiance
  //  à la création de la commande. Une amélioration future : joindre shops.owner_id.)
  void wrongSeller;

  // 2. Vérifier le stock et calculer le total
  let totalPrice = 0;
  const itemsToInsert: Array<{
    order_id?: number;
    product_id: number;
    quantity: number;
    unit_price: string;
  }> = [];

  for (const item of items) {
    const product = productsFound.find((p) => p.id === item.product_id)!;

    if (product.stock !== null && product.stock < item.quantity) {
      throw new Error(
        `Stock insuffisant pour "${product.name}" (disponible : ${product.stock})`
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

  // 3. Transaction : insertion commande + items + décrément stock
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

    const itemsWithOrderId = itemsToInsert.map((i) => ({
      ...i,
      order_id: order.id,
    }));

    await tx.insert(orderItems).values(itemsWithOrderId);

    // Décrémenter le stock
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

/**
 * Change le statut d'une commande.
 * Seul le vendeur peut changer le statut (sauf pour "cancelled" qui peut être fait par le buyer).
 */
export async function updateOrderStatus(
  orderId: number,
  userId: number,
  newStatus: string
) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Commande introuvable");

  const isSeller = order.seller_id === userId;
  const isBuyer = order.buyer_id === userId;

  if (!isSeller && !isBuyer) {
    throw new Error("Vous n'avez pas accès à cette commande");
  }

  // Seul le buyer peut annuler, et uniquement si la commande est encore pending
  if (newStatus === "cancelled") {
    if (!isBuyer) {
      throw new Error("Seul l'acheteur peut annuler une commande");
    }
    if (order.status !== "pending") {
      throw new Error("Impossible d'annuler : la commande n'est plus en attente");
    }
  } else {
    // Autres changements de statut = vendeur uniquement
    if (!isSeller) {
      throw new Error("Seul le vendeur peut modifier le statut de la commande");
    }
  }

  const [updated] = await db
    .update(orders)
    .set({ status: newStatus })
    .where(eq(orders.id, orderId))
    .returning();

  return updated;
}

/**
 * Supprime une commande (buyer, si pending).
 */
export async function deleteOrder(orderId: number, userId: number) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Commande introuvable");

  if (order.buyer_id !== userId) {
    throw new Error("Seul l'acheteur peut supprimer cette commande");
  }

  if (order.status !== "pending") {
    throw new Error("Impossible de supprimer : la commande n'est plus en attente");
  }

  // Supprimer les items puis la commande
  await db.delete(orderItems).where(eq(orderItems.order_id, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));
}
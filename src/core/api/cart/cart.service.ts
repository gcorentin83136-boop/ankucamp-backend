import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  carts,
  products,
  shops,
  orders,
  orderItems,
  promoCodes,
  promoUses,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { isShopHidden, isShopOnVacation } from "../settings/shop/shop.service";
import type {
  AddToCartInput,
  UpdateCartItemInput,
  CartCheckoutInput,
} from "./cart.validation";

// ============================================================
// HELPERS
// ============================================================

async function assertProductAvailable(productId: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw new AppError("Produit introuvable", 404);

  const hidden = await isShopHidden(product.shop_id);
  if (hidden) {
    throw new AppError("Ce produit n'est pas disponible", 403);
  }

  return product;
}

async function enrichCartItem(item: any) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      image_url: products.image_url,
      stock: products.stock,
      shop_id: products.shop_id,
    })
    .from(products)
    .where(eq(products.id, item.product_id))
    .limit(1);

  if (!product) return null;

  const [shop] = await db
    .select({
      id: shops.id,
      name: shops.name,
      owner_id: shops.owner_id,
    })
    .from(shops)
    .where(eq(shops.id, product.shop_id))
    .limit(1);

  const unitPrice = Number(product.price);
  const subtotal = unitPrice * item.quantity;

  return {
    id: item.id,
    product_id: item.product_id,
    quantity: item.quantity,
    product,
    shop,
    unit_price: unitPrice,
    subtotal,
    added_at: item.created_at,
  };
}

// ============================================================
// LECTURE — MON PANIER
// ============================================================

export async function getMyCart(userId: number) {
  const rows = await db
    .select()
    .from(carts)
    .where(eq(carts.user_id, userId))
    .orderBy(carts.created_at);

  const items = (await Promise.all(rows.map(enrichCartItem))).filter(
    (x) => x !== null
  );

  const subtotal = items.reduce((sum, i) => sum + i!.subtotal, 0);
  const items_count = items.reduce((sum, i) => sum + i!.quantity, 0);

  const bySeller: Record<
    number,
    { shop_id: number; shop_name: string; items: any[]; subtotal: number }
  > = {};
  for (const item of items) {
    if (!item) continue;
    const sid = item.shop!.owner_id;
    if (!bySeller[sid]) {
      bySeller[sid] = {
        shop_id: item.shop!.id,
        shop_name: item.shop!.name,
        items: [],
        subtotal: 0,
      };
    }
    bySeller[sid].items.push(item);
    bySeller[sid].subtotal += item.subtotal;
  }

  return {
    items,
    items_count,
    subtotal: Number(subtotal.toFixed(2)),
    by_seller: Object.values(bySeller),
  };
}

// ============================================================
// AJOUTER
// ============================================================

export async function addToCart(userId: number, input: AddToCartInput) {
  const product = await assertProductAvailable(input.product_id);

  if (product.stock !== null && product.stock < input.quantity) {
    throw new AppError(
      `Stock insuffisant (disponible : ${product.stock})`,
      400
    );
  }

  const [existing] = await db
    .select()
    .from(carts)
    .where(
      and(eq(carts.user_id, userId), eq(carts.product_id, input.product_id))
    )
    .limit(1);

  if (existing) {
    const newQty = existing.quantity + input.quantity;
    if (product.stock !== null && product.stock < newQty) {
      throw new AppError(
        `Stock insuffisant pour cette quantité (disponible : ${product.stock})`,
        400
      );
    }

    await db
      .update(carts)
      .set({ quantity: newQty, updated_at: new Date() })
      .where(eq(carts.id, existing.id));
  } else {
    await db.insert(carts).values({
      user_id: userId,
      product_id: input.product_id,
      quantity: input.quantity,
    });
  }

  return getMyCart(userId);
}

// ============================================================
// MODIFIER QUANTITÉ
// ============================================================

export async function updateCartItem(
  userId: number,
  productId: number,
  input: UpdateCartItemInput
) {
  const [item] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.user_id, userId), eq(carts.product_id, productId)))
    .limit(1);

  if (!item) throw new AppError("Ce produit n'est pas dans ton panier", 404);

  const product = await assertProductAvailable(productId);
  if (product.stock !== null && product.stock < input.quantity) {
    throw new AppError(
      `Stock insuffisant (disponible : ${product.stock})`,
      400
    );
  }

  await db
    .update(carts)
    .set({ quantity: input.quantity, updated_at: new Date() })
    .where(eq(carts.id, item.id));

  return getMyCart(userId);
}

// ============================================================
// RETIRER
// ============================================================

export async function removeFromCart(userId: number, productId: number) {
  const [item] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.user_id, userId), eq(carts.product_id, productId)))
    .limit(1);

  if (!item) throw new AppError("Ce produit n'est pas dans ton panier", 404);

  await db.delete(carts).where(eq(carts.id, item.id));
  return getMyCart(userId);
}

export async function clearCart(userId: number) {
  await db.delete(carts).where(eq(carts.user_id, userId));
  return { success: true };
}

// ============================================================
// CHECKOUT — transformer panier en commande(s)
// ============================================================

export async function checkoutCart(userId: number, input: CartCheckoutInput) {
  const cartData = await getMyCart(userId);
  if (cartData.items.length === 0) {
    throw new AppError("Ton panier est vide", 400);
  }

  let promo: any = null;
  let discountPercent = 0;
  let discountFixed = 0;

  if (input.promo_code) {
    const [found] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, input.promo_code.toUpperCase()))
      .limit(1);

    if (!found) throw new AppError("Code promo invalide", 400);
    if (found.is_active !== 1) throw new AppError("Code promo inactif", 400);
    if (found.valid_until && found.valid_until < new Date()) {
      throw new AppError("Code promo expiré", 400);
    }
    if (found.max_uses && found.uses_count >= found.max_uses) {
      throw new AppError("Code promo épuisé", 400);
    }
    if (found.min_amount && cartData.subtotal < Number(found.min_amount)) {
      throw new AppError(
        `Montant minimum de ${found.min_amount}€ non atteint`,
        400
      );
    }

    promo = found;
    if (found.type === "percent") discountPercent = Number(found.value);
    if (found.type === "fixed") discountFixed = Number(found.value);
  }

  const bySeller = new Map<
    number,
    { items: typeof cartData.items; subtotal: number }
  >();

  for (const item of cartData.items) {
    if (!item) continue;
    const sid = item.shop!.owner_id;
    if (bySeller.has(sid)) {
      bySeller.get(sid)!.items.push(item);
      bySeller.get(sid)!.subtotal += item.subtotal;
    } else {
      bySeller.set(sid, { items: [item], subtotal: item.subtotal });
    }
  }

  for (const [sellerId] of bySeller) {
    const shopId = cartData.items.find(
      (i) => i && i.shop!.owner_id === sellerId
    )!.shop!.id;
    if (await isShopHidden(shopId)) {
      throw new AppError("Une boutique est temporairement indisponible", 403);
    }
    if (await isShopOnVacation(shopId)) {
      throw new AppError("Une boutique est en vacances", 403);
    }
  }

  const createdOrders = await db.transaction(async (tx) => {
    const orderList: { id: number; seller_id: number; total: number }[] = [];

    for (const [sellerId, group] of bySeller) {
      let total = group.subtotal;

      if (discountPercent > 0) {
        total = total * (1 - discountPercent / 100);
      } else if (discountFixed > 0) {
        total = Math.max(0, total - discountFixed);
        discountFixed = 0;
      }

      total = Number(total.toFixed(2));

      const [order] = await tx
        .insert(orders)
        .values({
          buyer_id: userId,
          seller_id: sellerId,
          total_price: total.toFixed(2),
          status: "pending",
          delivery_method: input.delivery_method,
          delivery_address: input.delivery_address ?? null,
        })
        .returning();

      for (const item of group.items) {
        if (!item) continue;
        await tx.insert(orderItems).values({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: String(item.unit_price),
        });

        if (item.product!.stock !== null) {
          await tx
            .update(products)
            .set({ stock: item.product!.stock - item.quantity })
            .where(eq(products.id, item.product_id));
        }
      }

      orderList.push({ id: order.id, seller_id: sellerId, total });
    }

    if (promo) {
      await tx.insert(promoUses).values({
        promo_id: promo.id,
        user_id: userId,
        order_id: orderList[0]?.id ?? null,
      });
      await tx
        .update(promoCodes)
        .set({ uses_count: sql`${promoCodes.uses_count} + 1` })
        .where(eq(promoCodes.id, promo.id));
    }

    await tx.delete(carts).where(eq(carts.user_id, userId));

    return orderList;
  });

  return {
    success: true,
    orders_count: createdOrders.length,
    orders: createdOrders,
    message: `${createdOrders.length} commande(s) créée(s). Procède au paiement.`,
  };
}
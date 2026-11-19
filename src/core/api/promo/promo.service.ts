import { eq, and, desc, sql, ne, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  promoCodes,
  promoUses,
  users,
  shops,
  products,
  notifications,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type {
  CreatePromoInput,
  UpdatePromoInput,
  ListPromosQuery,
  ValidatePromoInput,
} from "./promo.validation";

// ============================================================
// HELPERS
// ============================================================

async function getPromoById(id: number) {
  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);
  if (!promo) throw new AppError("Code promo introuvable", 404);
  return promo;
}

async function countUserUses(promoId: number, userId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promoUses)
    .where(
      and(eq(promoUses.promo_id, promoId), eq(promoUses.user_id, userId))
    );
  return row?.count ?? 0;
}

async function assertProductsBelongToSeller(
  productIds: number[],
  sellerId: number
) {
  if (productIds.length === 0) return true;

  const rows = await db
    .select({ shop_id: products.shop_id })
    .from(products)
    .where(inArray(products.id, productIds));

  if (rows.length !== productIds.length) return false;

  const shopIds = Array.from(new Set(rows.map((r) => r.shop_id)));
  const sellerShops = await db
    .select({ id: shops.id })
    .from(shops)
    .where(and(eq(shops.owner_id, sellerId), inArray(shops.id, shopIds)));

  return sellerShops.length === shopIds.length;
}

function computeDiscount(
  type: string,
  value: number,
  subtotal: number
): number {
  if (type === "percent") {
    return Number(((subtotal * value) / 100).toFixed(2));
  }
  return Math.min(value, subtotal);
}

// ============================================================
// VALIDATION D'UN CODE (user, avant checkout)
// ============================================================

export async function validatePromoCode(
  userId: number,
  input: ValidatePromoInput
) {
  const code = input.code.trim().toUpperCase();

  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);

  if (!promo) throw new AppError("Code promo invalide", 404);
  if (promo.is_active !== 1) throw new AppError("Code promo désactivé", 400);

  const now = new Date();
  if (promo.valid_from && promo.valid_from > now) {
    throw new AppError("Code promo pas encore actif", 400);
  }
  if (promo.valid_until && promo.valid_until < now) {
    throw new AppError("Code promo expiré", 400);
  }
  if (promo.max_uses && promo.uses_count >= promo.max_uses) {
    throw new AppError("Code promo épuisé", 400);
  }
  if (promo.max_uses_per_user) {
    const userUses = await countUserUses(promo.id, userId);
    if (userUses >= promo.max_uses_per_user) {
      throw new AppError("Tu as déjà utilisé ce code", 400);
    }
  }
  if (promo.min_amount && input.subtotal < Number(promo.min_amount)) {
    throw new AppError(
      `Montant minimum de ${promo.min_amount}€ non atteint`,
      400
    );
  }

  if (promo.seller_id && input.product_ids && input.product_ids.length > 0) {
    const compatible = await assertProductsBelongToSeller(
      input.product_ids,
      promo.seller_id
    );
    if (!compatible) {
      throw new AppError(
        "Ce code ne s'applique pas aux produits de ton panier",
        400
      );
    }
  }

  const discount = computeDiscount(
    promo.type,
    Number(promo.value),
    input.subtotal
  );

  return {
    valid: true,
    code: promo.code,
    type: promo.type,
    value: Number(promo.value),
    seller_id: promo.seller_id,
    description: promo.description,
    discount_preview: discount,
    new_subtotal: Number((input.subtotal - discount).toFixed(2)),
  };
}

// ============================================================
// ADMIN — CRUD
// ============================================================

export async function listAllPromoCodes(query: ListPromosQuery) {
  const { active_only, limit, offset } = query;

  const conditions: any[] = [];
  if (active_only) conditions.push(eq(promoCodes.is_active, 1));

  const rows = await db
    .select()
    .from(promoCodes)
    .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
    .orderBy(desc(promoCodes.created_at))
    .limit(limit)
    .offset(offset);

  // Enrichir avec le vendeur (si seller_id présent)
  const sellerIds = [
    ...new Set(rows.map((r) => r.seller_id).filter((id): id is number => !!id)),
  ];

  if (sellerIds.length === 0) {
    return rows.map((r) => ({ ...r, seller: null }));
  }

  const sellersFound = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      email: users.email,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(inArray(users.id, sellerIds));

  const sellersMap = new Map(sellersFound.map((s) => [s.id, s]));

  return rows.map((r) => ({
    ...r,
    seller: r.seller_id ? sellersMap.get(r.seller_id) ?? null : null,
  }));
}

export async function createPromoCode(
  adminId: number,
  input: CreatePromoInput
) {
  const [existing] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, input.code))
    .limit(1);
  if (existing) throw new AppError("Ce code existe déjà", 409);

  if (input.type === "percent" && input.value > 100) {
    throw new AppError("Un pourcentage ne peut pas dépasser 100", 400);
  }

  const [created] = await db
    .insert(promoCodes)
    .values({
      code: input.code,
      description: input.description ?? null,
      type: input.type,
      value: String(input.value),
      min_amount:
        input.min_amount !== undefined && input.min_amount !== null
          ? String(input.min_amount)
          : null,
      max_uses: input.max_uses ?? null,
      max_uses_per_user: input.max_uses_per_user ?? null,
      valid_from: input.valid_from ?? new Date(),
      valid_until: input.valid_until ?? null,
      is_active: input.is_active ? 1 : 0,
      seller_id: null,
      created_by: adminId,
    })
    .returning();

  if (input.notify_users) {
    await notifyAllUsers(created.code, created.description, adminId);
  }

  return created;
}

async function notifyAllUsers(
  code: string,
  description: string | null,
  excludeUserId: number
) {
  const allUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.id, excludeUserId));

  if (allUsers.length === 0) return;

  await db.insert(notifications).values(
    allUsers.map((u) => ({
      user_id: u.id,
      type: "promo",
      title: "Nouveau code promo 🎁",
      content: description
        ? `Code "${code}" : ${description}`
        : `Code "${code}" disponible`,
      link: "/promos",
    }))
  );
}

export async function updatePromoCode(
  id: number,
  input: UpdatePromoInput,
  adminId: number
) {
  const promo = await getPromoById(id);

  const dataToUpdate: any = { ...input };
  if (typeof input.value === "number") dataToUpdate.value = String(input.value);
  if (typeof input.min_amount === "number")
    dataToUpdate.min_amount = String(input.min_amount);
  if (typeof input.is_active === "boolean")
    dataToUpdate.is_active = input.is_active ? 1 : 0;

  const [updated] = await db
    .update(promoCodes)
    .set(dataToUpdate)
    .where(eq(promoCodes.id, id))
    .returning();

  return updated;
}

export async function deletePromoCode(id: number) {
  await getPromoById(id);
  await db.delete(promoUses).where(eq(promoUses.promo_id, id));
  await db.delete(promoCodes).where(eq(promoCodes.id, id));
}

// ============================================================
// SELLER — CRUD
// ============================================================

export async function listSellerPromoCodes(
  sellerId: number,
  query: ListPromosQuery
) {
  const { active_only, limit, offset } = query;

  const conditions: any[] = [eq(promoCodes.seller_id, sellerId)];
  if (active_only) conditions.push(eq(promoCodes.is_active, 1));

  return db
    .select()
    .from(promoCodes)
    .where(and(...conditions))
    .orderBy(desc(promoCodes.created_at))
    .limit(limit)
    .offset(offset);
}

export async function createSellerPromoCode(
  sellerId: number,
  input: CreatePromoInput
) {
  const [existing] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, input.code))
    .limit(1);
  if (existing) throw new AppError("Ce code existe déjà", 409);

  if (input.type === "percent" && input.value > 100) {
    throw new AppError("Un pourcentage ne peut pas dépasser 100", 400);
  }

  const [created] = await db
    .insert(promoCodes)
    .values({
      code: input.code,
      description: input.description ?? null,
      type: input.type,
      value: String(input.value),
      min_amount:
        input.min_amount !== undefined && input.min_amount !== null
          ? String(input.min_amount)
          : null,
      max_uses: input.max_uses ?? null,
      max_uses_per_user: input.max_uses_per_user ?? null,
      valid_from: input.valid_from ?? new Date(),
      valid_until: input.valid_until ?? null,
      is_active: input.is_active ? 1 : 0,
      seller_id: sellerId,
      created_by: sellerId,
    })
    .returning();

  return created;
}

export async function updateSellerPromoCode(
  id: number,
  sellerId: number,
  input: UpdatePromoInput
) {
  const promo = await getPromoById(id);
  if (promo.seller_id !== sellerId) {
    throw new AppError("Tu ne peux modifier que tes propres codes", 403);
  }

  const dataToUpdate: any = { ...input };
  if (typeof input.value === "number") dataToUpdate.value = String(input.value);
  if (typeof input.min_amount === "number")
    dataToUpdate.min_amount = String(input.min_amount);
  if (typeof input.is_active === "boolean")
    dataToUpdate.is_active = input.is_active ? 1 : 0;

  const [updated] = await db
    .update(promoCodes)
    .set(dataToUpdate)
    .where(eq(promoCodes.id, id))
    .returning();

  return updated;
}

export async function deleteSellerPromoCode(id: number, sellerId: number) {
  const promo = await getPromoById(id);
  if (promo.seller_id !== sellerId) {
    throw new AppError("Tu ne peux supprimer que tes propres codes", 403);
  }

  await db.delete(promoUses).where(eq(promoUses.promo_id, id));
  await db.delete(promoCodes).where(eq(promoCodes.id, id));
}
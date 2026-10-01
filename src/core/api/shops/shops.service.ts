import { eq, notInArray, and, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { shops, shopSettings, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getBadgesForUsers, getUserBadges } from "../badges/badges.service";
import {
  getBulkSellerRatings,
  getSellerGlobalRating,
} from "../reviews/reviews.service";
import { geocodeAddress } from "../geo/geocoding.service";
import type { CreateShopInput, UpdateShopInput } from "./shops.validation";

// ============================================================
// HELPERS
// ============================================================

async function getHiddenShopIds(): Promise<number[]> {
  const rows = await db
    .select({ shop_id: shopSettings.shop_id })
    .from(shopSettings)
    .where(eq(shopSettings.is_hidden, 1));
  return rows.map((r) => r.shop_id);
}

async function enrichShop(
  shop: any,
  badgesMap?: Map<number, string[]>,
  ratingsMap?: Map<number, { average: number; count: number }>
) {
  const [owner] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
      verification_status: users.verification_status,
    })
    .from(users)
    .where(eq(users.id, shop.owner_id))
    .limit(1);

  if (!owner) return { ...shop, owner: null };

  const badges = badgesMap
    ? badgesMap.get(owner.id) ?? []
    : await getUserBadges(owner.id);

  const rating = ratingsMap
    ? ratingsMap.get(owner.id) ?? { average: 0, count: 0 }
    : await getSellerGlobalRating(owner.id);

  return {
    ...shop,
    latitude: shop.latitude !== null ? Number(shop.latitude) : null,
    longitude: shop.longitude !== null ? Number(shop.longitude) : null,
    owner: { ...owner, badges, rating },
  };
}

async function maybeGeocode(
  input: CreateShopInput | UpdateShopInput,
  existingShop?: { latitude: string | null; longitude: string | null }
) {
  const hasCoords =
    input.latitude !== undefined &&
    input.longitude !== undefined &&
    input.latitude !== null &&
    input.longitude !== null;

  if (hasCoords) return;
  if (!input.address) return;
  if (existingShop?.latitude && existingShop?.longitude) return;

  try {
    const result = await geocodeAddress(input.address);
    input.latitude = result.latitude;
    input.longitude = result.longitude;
    if (!input.city) input.city = result.city;
    if (!input.postal_code) input.postal_code = result.postal_code;
  } catch (err) {
    console.error("⚠️ Auto-geocode échoué :", err);
  }
}

// ============================================================
// LECTURE
// ============================================================

export async function getAllShops() {
  const hiddenIds = await getHiddenShopIds();

  const rows =
    hiddenIds.length === 0
      ? await db.select().from(shops)
      : await db
          .select()
          .from(shops)
          .where(notInArray(shops.id, hiddenIds));

  const ownerIds = rows.map((r) => r.owner_id);
  const badgesMap = await getBadgesForUsers(ownerIds);
  const ratingsMap = await getBulkSellerRatings(ownerIds);

  return Promise.all(rows.map((r) => enrichShop(r, badgesMap, ratingsMap)));
}

export async function getShopById(id: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, id))
    .limit(1);

  if (!shop) return null;
  return enrichShop(shop);
}

export async function getShopsByOwner(ownerId: number) {
  return db.select().from(shops).where(eq(shops.owner_id, ownerId));
}

export async function getShopsNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number,
  offset: number
) {
  const hiddenIds = await getHiddenShopIds();

  const distance = sql<number>`(
    6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(${lat})) * cos(radians(${shops.latitude})) *
        cos(radians(${shops.longitude}) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(${shops.latitude}))
      ))
    )
  )`;

  const whereConditions: any[] = [
    isNotNull(shops.latitude),
    isNotNull(shops.longitude),
    sql`${distance} <= ${radiusKm}`,
  ];

  if (hiddenIds.length > 0) {
    whereConditions.push(notInArray(shops.id, hiddenIds));
  }

  const rows = await db
    .select({
      shop: shops,
      distance_km: distance,
    })
    .from(shops)
    .where(and(...whereConditions))
    .orderBy(distance)
    .limit(limit)
    .offset(offset);

  const ownerIds = rows.map((r) => r.shop.owner_id);
  const badgesMap = await getBadgesForUsers(ownerIds);
  const ratingsMap = await getBulkSellerRatings(ownerIds);

  return Promise.all(
    rows.map(async (r) => {
      const enriched = await enrichShop(r.shop, badgesMap, ratingsMap);
      return {
        ...enriched,
        distance_km: Number(Number(r.distance_km).toFixed(2)),
      };
    })
  );
}

// ============================================================
// ÉCRITURE
// ============================================================

export async function createShop(ownerId: number, input: CreateShopInput) {
  await maybeGeocode(input);

  const [created] = await db
    .insert(shops)
    .values({
      owner_id: ownerId,
      name: input.name,
      description: input.description ?? null,
      logo_url: input.logo_url || null,
      banner_url: input.banner_url || null,
      address: input.address ?? null,
      city: input.city ?? null,
      postal_code: input.postal_code ?? null,
      phone: input.phone ?? null,
      latitude:
        input.latitude !== undefined && input.latitude !== null
          ? String(input.latitude)
          : null,
      longitude:
        input.longitude !== undefined && input.longitude !== null
          ? String(input.longitude)
          : null,
    })
    .returning();

  return created;
}

export async function updateShop(
  shopId: number,
  userId: number,
  input: UpdateShopInput
) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);
  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  if (input.address && input.address !== shop.address) {
    await maybeGeocode(input, {
      latitude: shop.latitude,
      longitude: shop.longitude,
    });
  }

  const dataToUpdate: any = { ...input };
  if (typeof input.latitude === "number") {
    dataToUpdate.latitude = String(input.latitude);
  }
  if (typeof input.longitude === "number") {
    dataToUpdate.longitude = String(input.longitude);
  }

  const [updated] = await db
    .update(shops)
    .set(dataToUpdate)
    .where(eq(shops.id, shopId))
    .returning();

  return updated;
}

export async function deleteShop(shopId: number, userId: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) throw new AppError("Boutique introuvable", 404);
  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  await db.delete(shops).where(eq(shops.id, shopId));
}
import {
  eq,
  and,
  or,
  desc,
  asc,
  sql,
  ilike,
  notInArray,
  gte,
  lte,
  inArray,
  isNotNull,
} from "drizzle-orm";
import { db } from "../../db";
import {
  users,
  shops,
  shopSettings,
  products,
  follows,
  userBadges,
  userSettings,
  shopCategories,
} from "../../db/schema";
import type {
  SearchUsersQuery,
  SearchShopsQuery,
  SearchProductsQuery,
  SearchAllQuery,
  SuggestQuery,
} from "./search.validation";

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

/**
 * Construit l'expression SQL de distance Haversine (en km).
 * Utilisable pour : SELECT distance_km, WHERE distance <= radius, ORDER BY distance.
 */
function buildDistanceExpr(
  table: { latitude: any; longitude: any },
  lat: number,
  lng: number
) {
  return sql<number>`(
    6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(${lat})) * cos(radians(${table.latitude}::numeric)) *
        cos(radians(${table.longitude}::numeric) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(${table.latitude}::numeric))
      ))
    )
  )`;
}

/**
 * Ajoute les conditions geo (lat/lng non null + distance <= radius).
 * Retourne null si lat/lng non fournis.
 */
function applyGeoFilters(
  conditions: any[],
  table: { latitude: any; longitude: any },
  lat?: number,
  lng?: number,
  radius?: number
): any {
  if (lat === undefined || lng === undefined) return null;

  const distanceExpr = buildDistanceExpr(table, lat, lng);
  conditions.push(isNotNull(table.latitude));
  conditions.push(isNotNull(table.longitude));
  conditions.push(sql`${distanceExpr} <= ${radius ?? 25}`);

  return distanceExpr;
}

// ============================================================
// RECHERCHE USERS
// ============================================================

export async function searchUsers(query: SearchUsersQuery) {
  const { q, role, city, sort, limit, offset, lat, lng, radius } = query;

  const conditions: any[] = [
    eq(userSettings.search_indexable, 1),
    sql`${users.email_verified} = 1`,
  ];

  if (q && q.trim() !== "") {
    const term = `%${q.toLowerCase().trim()}%`;
    conditions.push(
      or(
        sql`unaccent(lower(${users.first_name})) LIKE unaccent(${term})`,
        sql`unaccent(lower(${users.last_name})) LIKE unaccent(${term})`,
        sql`unaccent(lower(${users.username})) LIKE unaccent(${term})`,
        sql`unaccent(lower(coalesce(${users.bio}, ''))) LIKE unaccent(${term})`
      )
    );
  }

  if (role) conditions.push(eq(users.role, role));
  if (city) {
    conditions.push(
      sql`unaccent(lower(${users.city})) = unaccent(lower(${city}))`
    );
  }

  const distanceExpr = applyGeoFilters(conditions, users, lat, lng, radius);
  const hasGeo = distanceExpr !== null;

  let orderBy;
  switch (sort) {
    case "alphabetical":
      orderBy = asc(users.first_name);
      break;
    case "recent":
      orderBy = desc(users.created_at);
      break;
    case "relevance":
    default:
      orderBy = hasGeo ? sql`${distanceExpr} ASC` : desc(users.created_at);
      break;
  }

  const selectFields: any = {
    id: users.id,
    first_name: users.first_name,
    last_name: users.last_name,
    username: users.username,
    avatar_url: users.avatar_url,
    cover_url: users.cover_url,
    bio: users.bio,
    city: users.city,
    role: users.role,
    is_private: users.is_private,
    created_at: users.created_at,
  };

  if (hasGeo) {
    selectFields.distance_km = distanceExpr;
  }

  return db
    .select(selectFields)
    .from(users)
    .innerJoin(userSettings, eq(userSettings.user_id, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);
}

// ============================================================
// RECHERCHE SHOPS
// ============================================================

export async function searchShops(query: SearchShopsQuery) {
  const { q, city, category_id, sort, limit, offset, lat, lng, radius } = query;

  const hiddenShopIds = await getHiddenShopIds();
  const conditions: any[] = [];

  if (hiddenShopIds.length > 0) {
    conditions.push(notInArray(shops.id, hiddenShopIds));
  }

  if (q && q.trim() !== "") {
    const term = `%${q.toLowerCase().trim()}%`;
    conditions.push(
      or(
        sql`unaccent(lower(${shops.name})) LIKE unaccent(${term})`,
        sql`unaccent(lower(coalesce(${shops.description}, ''))) LIKE unaccent(${term})`
      )
    );
  }

  if (city) {
    conditions.push(
      sql`unaccent(lower(${shops.city})) = unaccent(lower(${city}))`
    );
  }

  if (category_id) {
    const shopIdsInCategory = await db
      .select({ shop_id: shopCategories.shop_id })
      .from(shopCategories)
      .where(eq(shopCategories.category_id, category_id));

    const ids = shopIdsInCategory.map((s) => s.shop_id);
    if (ids.length === 0) return [];
    conditions.push(inArray(shops.id, ids));
  }

  const distanceExpr = applyGeoFilters(conditions, shops, lat, lng, radius);
  const hasGeo = distanceExpr !== null;

  let orderBy;
  switch (sort) {
    case "rating":
      orderBy = desc(
        sql`(SELECT AVG(rating) FROM reviews WHERE seller_id = ${shops.owner_id} AND is_flagged = 0)`
      );
      break;
    case "products_count":
      orderBy = desc(
        sql`(SELECT COUNT(*) FROM products WHERE shop_id = ${shops.id})`
      );
      break;
    case "recent":
      orderBy = desc(shops.created_at);
      break;
    case "relevance":
    default:
      orderBy = hasGeo ? sql`${distanceExpr} ASC` : desc(shops.created_at);
      break;
  }

  const selectFields: any = {
    id: shops.id,
    name: shops.name,
    description: shops.description,
    logo_url: shops.logo_url,
    banner_url: shops.banner_url,
    city: shops.city,
    postal_code: shops.postal_code,
    created_at: shops.created_at,
    products_count: sql<number>`(
      SELECT COUNT(*)::int FROM products WHERE shop_id = ${shops.id}
    )`,
    followers_count: sql<number>`(
      SELECT COUNT(*)::int FROM follows WHERE shop_id = ${shops.id}
    )`,
    average_rating: sql<number>`(
      SELECT COALESCE(AVG(rating), 0)::numeric(3,1)
      FROM reviews
      WHERE seller_id = ${shops.owner_id} AND is_flagged = 0
    )`,
    vacation_mode: sql<number>`COALESCE((
      SELECT vacation_mode FROM shop_settings WHERE shop_id = ${shops.id} LIMIT 1
    ), 0)`,
    owner_id: shops.owner_id,
    owner_username: users.username,
    owner_avatar_url: users.avatar_url,
    owner_verification_status: users.verification_status,
    owner_badges: sql<string[]>`COALESCE((
      SELECT json_agg(badge) FROM user_badges
      WHERE user_id = ${shops.owner_id} AND revoked_at IS NULL
    ), '[]'::json)`,
  };

  if (hasGeo) {
    selectFields.distance_km = distanceExpr;
  }

  return db
    .select(selectFields)
    .from(shops)
    .leftJoin(users, eq(users.id, shops.owner_id))
    .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);
}

// ============================================================
// RECHERCHE PRODUITS
// ============================================================

export async function searchProducts(query: SearchProductsQuery) {
  const {
    q,
    category_id,
    shop_id,
    city,
    min_price,
    max_price,
    in_stock,
    min_rating,
    sort,
    limit,
    offset,
    lat,
    lng,
    radius,
  } = query;

  const hiddenShopIds = await getHiddenShopIds();
  const conditions: any[] = [];

  if (hiddenShopIds.length > 0) {
    conditions.push(notInArray(products.shop_id, hiddenShopIds));
  }

  if (q && q.trim() !== "") {
    const term = `%${q.toLowerCase().trim()}%`;
    conditions.push(
      or(
        sql`unaccent(lower(${products.name})) LIKE unaccent(${term})`,
        sql`unaccent(lower(coalesce(${products.description}, ''))) LIKE unaccent(${term})`
      )
    );
  }

  if (shop_id) conditions.push(eq(products.shop_id, shop_id));
  if (city) {
    conditions.push(
      sql`unaccent(lower(${products.location})) = unaccent(lower(${city}))`
    );
  }
  if (min_price !== undefined) {
    conditions.push(gte(products.price, String(min_price)));
  }
  if (max_price !== undefined) {
    conditions.push(lte(products.price, String(max_price)));
  }
  if (in_stock) {
    conditions.push(sql`${products.stock} > 0`);
  }

  if (category_id) {
    const shopIdsInCategory = await db
      .select({ shop_id: shopCategories.shop_id })
      .from(shopCategories)
      .where(eq(shopCategories.category_id, category_id));

    const ids = shopIdsInCategory.map((s) => s.shop_id);
    if (ids.length === 0) return [];
    conditions.push(inArray(products.shop_id, ids));
  }

  if (min_rating !== undefined) {
    conditions.push(
      sql`(
        SELECT COALESCE(AVG(rating), 0) FROM reviews
        WHERE product_id = ${products.id} AND is_flagged = 0
      ) >= ${min_rating}`
    );
  }

  // Géo : on utilise les coords de la boutique (JOIN shops plus bas)
  const distanceExpr = applyGeoFilters(conditions, shops, lat, lng, radius);
  const hasGeo = distanceExpr !== null;

  let orderBy;
  switch (sort) {
    case "price_asc":
      orderBy = asc(products.price);
      break;
    case "price_desc":
      orderBy = desc(products.price);
      break;
    case "rating":
      orderBy = desc(
        sql`(SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = ${products.id} AND is_flagged = 0)`
      );
      break;
    case "recent":
      orderBy = desc(products.created_at);
      break;
    case "relevance":
    default:
      orderBy = hasGeo ? sql`${distanceExpr} ASC` : desc(products.created_at);
      break;
  }

  const selectFields: any = {
    id: products.id,
    shop_id: products.shop_id,
    name: products.name,
    description: products.description,
    image_url: products.image_url,
    location: products.location,
    price: products.price,
    stock: products.stock,
    created_at: products.created_at,
    shop_name: shops.name,
    shop_logo_url: shops.logo_url,
    average_rating: sql<number>`(
      SELECT COALESCE(AVG(rating), 0)::numeric(3,1)
      FROM reviews WHERE product_id = ${products.id} AND is_flagged = 0
    )`,
    reviews_count: sql<number>`(
      SELECT COUNT(*)::int FROM reviews WHERE product_id = ${products.id} AND is_flagged = 0
    )`,
  };

  if (hasGeo) {
    selectFields.distance_km = distanceExpr;
  }

  return db
    .select(selectFields)
    .from(products)
    .leftJoin(shops, eq(shops.id, products.shop_id))
    .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);
}

// ============================================================
// RECHERCHE GLOBALE (avec geo)
// ============================================================

export async function searchAll(query: SearchAllQuery) {
  const { q, limit_per_type, lat, lng, radius } = query;

  const [usersResults, shopsResults, productsResults] = await Promise.all([
    searchUsers({
      q,
      limit: limit_per_type,
      offset: 0,
      sort: "relevance",
      lat,
      lng,
      radius,
    } as any),
    searchShops({
      q,
      limit: limit_per_type,
      offset: 0,
      sort: "relevance",
      lat,
      lng,
      radius,
    } as any),
    searchProducts({
      q,
      limit: limit_per_type,
      offset: 0,
      sort: "relevance",
      lat,
      lng,
      radius,
    } as any),
  ]);

  return {
    users: usersResults,
    shops: shopsResults,
    products: productsResults,
  };
}

// ============================================================
// SUGGEST (inchangé — pas de géo)
// ============================================================

export async function suggest(query: SuggestQuery) {
  const { q, limit } = query;

  if (q.length < 2) return { users: [], shops: [], products: [] };

  const term = `%${q.toLowerCase().trim()}%`;
  const hiddenShopIds = await getHiddenShopIds();

  const [usersResults, shopsResults, productsResults] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        first_name: users.first_name,
        last_name: users.last_name,
        avatar_url: users.avatar_url,
      })
      .from(users)
      .innerJoin(userSettings, eq(userSettings.user_id, users.id))
      .where(
        and(
          eq(userSettings.search_indexable, 1),
          sql`${users.email_verified} = 1`,
          or(
            ilike(users.username, term),
            ilike(users.first_name, term),
            ilike(users.last_name, term)
          )
        )
      )
      .limit(limit),

    db
      .select({
        id: shops.id,
        name: shops.name,
        logo_url: shops.logo_url,
        city: shops.city,
      })
      .from(shops)
      .where(
        hiddenShopIds.length > 0
          ? and(notInArray(shops.id, hiddenShopIds), ilike(shops.name, term))
          : ilike(shops.name, term)
      )
      .limit(limit),

    db
      .select({
        id: products.id,
        name: products.name,
        image_url: products.image_url,
        price: products.price,
        shop_id: products.shop_id,
      })
      .from(products)
      .where(
        hiddenShopIds.length > 0
          ? and(
              notInArray(products.shop_id, hiddenShopIds),
              or(ilike(products.name, term), ilike(products.description, term))
            )
          : or(ilike(products.name, term), ilike(products.description, term))
      )
      .limit(limit),
  ]);

  return {
    users: usersResults,
    shops: shopsResults,
    products: productsResults,
  };
}
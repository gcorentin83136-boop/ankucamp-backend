import { z } from "zod";

// ============================================================
// BASE QUERY (avec geo optionnelle)
// ============================================================

const baseQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),

  // Géo (optionnel) — si lat+lng fournis, filtre + tri par distance
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(500).default(25),
});

// ============================================================
// RECHERCHE USERS
// ============================================================

export const searchUsersQuerySchema = baseQuerySchema.extend({
  role: z.enum(["particulier", "professionnel"]).optional(),
  city: z.string().max(100).optional(),
  sort: z
    .enum(["relevance", "recent", "alphabetical"])
    .default("relevance"),
});

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;

// ============================================================
// RECHERCHE SHOPS
// ============================================================

export const searchShopsQuerySchema = baseQuerySchema.extend({
  city: z.string().max(100).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  delivery: z
    .enum(["pickup", "shipping", "meeting"])
    .optional(),
  has_stock: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === "true" || v === true)
    .optional(),
  sort: z
    .enum(["relevance", "recent", "rating", "products_count"])
    .default("relevance"),
});

export type SearchShopsQuery = z.infer<typeof searchShopsQuerySchema>;

// ============================================================
// RECHERCHE PRODUITS
// ============================================================

export const searchProductsQuerySchema = baseQuerySchema.extend({
  category_id: z.coerce.number().int().positive().optional(),
  shop_id: z.coerce.number().int().positive().optional(),
  city: z.string().max(100).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  in_stock: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === "true" || v === true)
    .optional(),
  min_rating: z.coerce.number().min(1).max(5).optional(),
  sort: z
    .enum([
      "relevance",
      "recent",
      "price_asc",
      "price_desc",
      "rating",
    ])
    .default("relevance"),
});

export type SearchProductsQuery = z.infer<typeof searchProductsQuerySchema>;

// ============================================================
// RECHERCHE GLOBALE (avec geo)
// ============================================================

export const searchAllQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit_per_type: z.coerce.number().int().min(1).max(10).default(5),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(500).default(25),
});

export type SearchAllQuery = z.infer<typeof searchAllQuerySchema>;

// ============================================================
// AUTOCOMPLETE / SUGGEST
// ============================================================

export const suggestQuerySchema = z.object({
  q: z.string().min(2, "Minimum 2 caractères").max(50),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export type SuggestQuery = z.infer<typeof suggestQuerySchema>;
import { z } from "zod";

export const PROMO_TYPES = ["percent", "fixed"] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

// ============================================================
// VALIDATION D'UN CODE (user)
// ============================================================

export const validatePromoSchema = z.object({
  code: z.string().min(3).max(50),
  subtotal: z.number().min(0),
  product_ids: z.array(z.number().int().positive()).optional(),
});
export type ValidatePromoInput = z.infer<typeof validatePromoSchema>;

// ============================================================
// CREATE / UPDATE (admin + seller)
// ============================================================

export const createPromoSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .regex(
      /^[A-Z0-9_-]+$/i,
      "Le code doit contenir uniquement des lettres, chiffres, tirets ou underscores"
    )
    .transform((v) => v.toUpperCase()),
  description: z.string().max(255).optional().nullable(),
  type: z.enum(PROMO_TYPES),
  value: z.number().positive("La valeur doit être positive"),
  min_amount: z.number().min(0).optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  max_uses_per_user: z.number().int().positive().optional().nullable(),
  valid_from: z.coerce.date().optional().nullable(),
  valid_until: z.coerce.date().optional().nullable(),
  is_active: z.boolean().default(true),
  notify_users: z.boolean().default(false),
});
export type CreatePromoInput = z.infer<typeof createPromoSchema>;

export const updatePromoSchema = z.object({
  description: z.string().max(255).optional().nullable(),
  type: z.enum(PROMO_TYPES).optional(),
  value: z.number().positive().optional(),
  min_amount: z.number().min(0).optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  max_uses_per_user: z.number().int().positive().optional().nullable(),
  valid_from: z.coerce.date().optional().nullable(),
  valid_until: z.coerce.date().optional().nullable(),
  is_active: z.boolean().optional(),
});
export type UpdatePromoInput = z.infer<typeof updatePromoSchema>;

// ============================================================
// LIST QUERY
// ============================================================

export const listPromosQuerySchema = z.object({
  active_only: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === "true" || v === true)
    .default(false),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListPromosQuery = z.infer<typeof listPromosQuerySchema>;
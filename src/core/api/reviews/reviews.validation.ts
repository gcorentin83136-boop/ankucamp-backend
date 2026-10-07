import { z } from "zod";

// ============================================================
// CRÉATION D'UN AVIS
// ============================================================

export const createReviewSchema = z.object({
  order_id: z.number().int().positive("order_id requis"),
  product_id: z.number().int().positive("product_id requis"),
  rating: z
    .number()
    .int()
    .min(1, "La note minimale est 1")
    .max(5, "La note maximale est 5"),
  comment: z
    .string()
    .max(2000, "Le commentaire ne peut pas dépasser 2000 caractères")
    .optional()
    .nullable(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// ============================================================
// SIGNALEMENT D'UN AVIS
// ============================================================

export const reportReviewSchema = z.object({
  reason: z
    .string()
    .min(5, "La raison doit contenir au moins 5 caractères")
    .max(500, "La raison ne peut pas dépasser 500 caractères"),
});

export type ReportReviewInput = z.infer<typeof reportReviewSchema>;

// ============================================================
// QUERY DE LISTE (pagination)
// ============================================================

export const listReviewsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["recent", "rating_desc", "rating_asc"]).default("recent"),
});

export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

// ============================================================
// RÉPONSE VENDEUR (à un avis)
// ============================================================
export const replyReviewSchema = z.object({
  reply_text: z
    .string()
    .min(2, "La réponse doit faire au moins 2 caractères")
    .max(2000, "La réponse est trop longue"),
});
export type ReplyReviewInput = z.infer<typeof replyReviewSchema>;

// ============================================================
// MODIFICATION D'UN AVIS (par le buyer)
// ============================================================
export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional().nullable(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
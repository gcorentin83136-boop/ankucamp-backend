import { z } from "zod";

// ============================================================
// CRÉATION D'UN POST
// ============================================================

export const createPostSchema = z.object({
  content: z
    .string()
    .max(5000, "Le post ne peut pas dépasser 5000 caractères")
    .optional()
    .nullable(),
  media_urls: z
    .array(z.string().url())
    .max(4, "Maximum 4 médias par post")
    .optional()
    .default([]),
  visibility: z
    .enum(["public", "friends", "private"])
    .default("public"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// ============================================================
// MODIFICATION D'UN POST
// ============================================================

export const updatePostSchema = z.object({
  content: z
    .string()
    .max(5000)
    .optional()
    .nullable(),
  visibility: z.enum(["public", "friends", "private"]).optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// ============================================================
// CRÉATION D'UN COMMENTAIRE
// ============================================================

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Le commentaire ne peut pas être vide")
    .max(2000, "Le commentaire ne peut pas dépasser 2000 caractères"),
  parent_comment_id: z.number().int().positive().optional().nullable(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ============================================================
// PARTAGE D'UN POST
// ============================================================

export const sharePostSchema = z.object({
  share_comment: z
    .string()
    .max(2000, "Le commentaire de partage ne peut pas dépasser 2000 caractères")
    .optional()
    .nullable(),
  visibility: z
    .enum(["public", "friends", "private"])
    .default("public"),
});

export type SharePostInput = z.infer<typeof sharePostSchema>;

// ============================================================
// PAGINATION
// ============================================================

export const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Le commentaire ne peut pas être vide")
    .max(2000, "Trop long (max 2000 caractères)"),
  media_url: z.string().url().optional().nullable().or(z.literal("")),
  parent_comment_id: z.number().int().positive().optional().nullable(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const reactCommentSchema = z.object({
  emoji: z.string().min(1).max(10, "Emoji trop long"),
});
export type ReactCommentInput = z.infer<typeof reactCommentSchema>;

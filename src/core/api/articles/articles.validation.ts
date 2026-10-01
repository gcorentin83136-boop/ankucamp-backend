import { z } from "zod";

export const ARTICLE_CATEGORIES = [
  "recette",
  "conseil",
  "portrait",
  "actualite",
  "autre",
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const ARTICLE_STATUSES = ["draft", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const createArticleSchema = z.object({
  title: z.string().min(3).max(255),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().min(20, "Le contenu doit faire au moins 20 caractères"),
  cover_url: z.string().url().optional().nullable().or(z.literal("")),
  tags: z
    .array(z.string().min(1).max(30))
    .max(10, "Maximum 10 tags")
    .default([]),
  category: z.enum(ARTICLE_CATEGORIES),
  status: z.enum(["draft", "published"]).default("published"),
});
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = createArticleSchema.partial().extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
});
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const listArticlesQuerySchema = z.object({
  q: z.string().max(100).optional(),
  category: z.enum(["all", ...ARTICLE_CATEGORIES]).default("all"),
  tag: z.string().max(30).optional(),
  author_id: z.coerce.number().int().positive().optional(),
  sort: z.enum(["recent", "popular", "views"]).default("recent"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;
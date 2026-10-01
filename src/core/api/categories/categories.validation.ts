import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Le slug doit contenir uniquement des minuscules, chiffres et tirets"
    ),
  icon: z.string().max(100).optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
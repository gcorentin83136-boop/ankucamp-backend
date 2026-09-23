import { z } from "zod";

export const createProductSchema = z.object({
  shop_id: z.number().int().positive("shop_id doit être un entier positif"),
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères"),
  description: z.string().optional(),
  image_url: z.string().url("URL invalide").optional().or(z.literal("")),
  location: z.string().optional(),
  stock: z.number().int().min(0, "Le stock ne peut pas être négatif").optional(),
  price: z.number().positive("Le prix doit être positif"),
});

export const updateProductSchema = createProductSchema
  .omit({ shop_id: true })
  .partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
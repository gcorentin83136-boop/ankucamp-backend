import { z } from "zod";

export const createProductSchema = z.object({
  shop_id: z.number().int().positive("shop_id doit etre un entier positif"),
  name: z.string().min(2, "Le nom doit faire au moins 2 caracteres"),
  description: z.string().optional(),
  image_url: z.string().url("URL invalide").optional().or(z.literal("")),
  video_urls: z
    .array(z.string().url("URL video invalide"))
    .max(3, "Maximum 3 videos par produit")
    .optional(),
  location: z.string().optional(),
  stock: z.number().int().min(0, "Le stock ne peut pas etre negatif").optional(),
  has_unlimited_stock: z.boolean().optional(),
  price: z.number().positive("Le prix doit etre positif"),
  delivery_pickup: z.boolean().optional(),
  delivery_shipping: z.boolean().optional(),
  delivery_meeting: z.boolean().optional(),
  meeting_point_address: z
    .string()
    .max(500, "Adresse trop longue")
    .optional()
    .nullable(),
  meeting_point_instructions: z
    .string()
    .max(1000, "Instructions trop longues")
    .optional()
    .nullable(),
});

export const updateProductSchema = createProductSchema
  .omit({ shop_id: true })
  .partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

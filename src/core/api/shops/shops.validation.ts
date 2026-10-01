import { z } from "zod";

export const createShopSchema = z.object({
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères"),
  description: z.string().optional(),
  logo_url: z.string().url("URL invalide").optional().or(z.literal("")),
  banner_url: z.string().url("URL invalide").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export const updateShopSchema = createShopSchema.partial();

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
import { z } from "zod";

export const orderItemSchema = z.object({
  product_id: z.number().int().positive("product_id requis"),
  quantity: z.number().int().positive("La quantité doit être > 0"),
});

export const createOrderSchema = z.object({
  seller_id: z.number().int().positive("seller_id requis"),
  delivery_method: z.enum(["pickup", "delivery", "shipping"], {
    errorMap: () => ({
      message: "delivery_method invalide (pickup, delivery, shipping)",
    }),
  }),
  delivery_address: z.string().optional(),
  items: z
    .array(orderItemSchema)
    .min(1, "La commande doit contenir au moins un article"),
});

export const updateStatusSchema = z.object({
  status: z.enum(
    ["pending", "confirmed", "shipped", "delivered", "cancelled"],
    {
      errorMap: () => ({ message: "Statut invalide" }),
    }
  ),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
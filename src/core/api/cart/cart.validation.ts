import { z } from "zod";

export const addToCartSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99).default(1),
});
export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const cartCheckoutSchema = z.object({
  delivery_method: z.enum(["pickup", "delivery", "shipping"]),
  delivery_address: z.string().max(500).optional().nullable(),
  promo_code: z.string().max(50).optional().nullable(),
});
export type CartCheckoutInput = z.infer<typeof cartCheckoutSchema>;
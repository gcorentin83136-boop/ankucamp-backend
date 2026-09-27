import { z } from "zod";

export const createCheckoutSchema = z.object({
  order_id: z.number().int().positive("order_id doit être un entier positif"),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
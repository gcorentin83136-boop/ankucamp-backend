import { z } from "zod";

export const listWishlistQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListWishlistQuery = z.infer<typeof listWishlistQuerySchema>;
import { z } from "zod";

// ============================================================
// PAGINATION
// ============================================================

export const listFriendsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListFriendsQuery = z.infer<typeof listFriendsQuerySchema>;
import { z } from "zod";

export const listFollowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListFollowsQuery = z.infer<typeof listFollowsQuerySchema>;
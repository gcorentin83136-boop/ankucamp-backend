import { z } from "zod";

export const createPublicMessageSchema = z.object({
  content: z.string().min(1, "Le message ne peut pas être vide").max(2000),
});

export const createGroupMessageSchema = z.object({
  group_id: z.number().int().positive("group_id requis"),
  content: z.string().min(1).max(2000),
});

export const createSupportMessageSchema = z.object({
  receiver_id: z.number().int().positive("receiver_id requis"),
  content: z.string().min(1).max(2000),
});

export type CreatePublicMessageInput = z.infer<typeof createPublicMessageSchema>;
export type CreateGroupMessageInput = z.infer<typeof createGroupMessageSchema>;
export type CreateSupportMessageInput = z.infer<typeof createSupportMessageSchema>;
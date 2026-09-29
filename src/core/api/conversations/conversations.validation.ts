import { z } from "zod";

// ============================================================
// CRÉATION D'UNE CONVERSATION
// ============================================================

export const createConversationSchema = z
  .object({
    type: z.enum(["direct", "group"], {
      errorMap: () => ({ message: "Type invalide (direct ou group)" }),
    }),
    name: z.string().min(1).max(255).optional().nullable(),
    avatar_url: z.string().url().optional().nullable(),
    participant_ids: z
      .array(z.number().int().positive())
      .min(1, "Il faut au moins un autre participant"),
  })
  .refine(
    (data) => {
      if (data.type === "direct" && data.participant_ids.length !== 1) {
        return false;
      }
      return true;
    },
    {
      message: "Une conversation directe doit avoir exactement 1 participant",
      path: ["participant_ids"],
    }
  )
  .refine(
    (data) => {
      if (data.type === "group" && !data.name) {
        return false;
      }
      return true;
    },
    {
      message: "Un groupe doit avoir un nom",
      path: ["name"],
    }
  );

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

// ============================================================
// MISE À JOUR D'UNE CONVERSATION (groupe)
// ============================================================

export const updateConversationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

// ============================================================
// AJOUT DE PARTICIPANT
// ============================================================

export const addParticipantSchema = z.object({
  user_id: z.number().int().positive("user_id requis"),
});

export type AddParticipantInput = z.infer<typeof addParticipantSchema>;

// ============================================================
// ENVOI DE MESSAGE
// ============================================================

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Le message ne peut pas être vide")
    .max(5000, "Le message est trop long")
    .optional()
    .nullable(),
  type: z.enum(["text", "image", "file"]).default("text"),
  media_url: z.string().url().optional().nullable(),
  reply_to_message_id: z.number().int().positive().optional().nullable(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ============================================================
// ÉDITION D'UN MESSAGE
// ============================================================

export const editMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Le message ne peut pas être vide")
    .max(5000, "Le message est trop long"),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;

// ============================================================
// MARQUER COMME LU
// ============================================================

export const markAsReadSchema = z.object({
  until_message_id: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
});

export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;

// ============================================================
// RÉACTION
// ============================================================

export const reactToMessageSchema = z.object({
  emoji: z
    .string()
    .min(1)
    .max(10, "Emoji trop long"),
});

export type ReactToMessageInput = z.infer<typeof reactToMessageSchema>;

// ============================================================
// PAGINATION
// ============================================================

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before_message_id: z.coerce.number().int().positive().optional(),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
import { z } from "zod";

// ============================================================
// PRÉFÉRENCES EMAIL
// ============================================================

export const emailPrefsSchema = z.object({
  email_order_updates: z.boolean().optional(),
  email_new_messages: z.boolean().optional(),
  email_social_activity: z.boolean().optional(),
  email_marketing: z.boolean().optional(),
});

export type EmailPrefsInput = z.infer<typeof emailPrefsSchema>;

// ============================================================
// PRÉFÉRENCES PUSH
// ============================================================

export const pushPrefsSchema = z.object({
  push_order_updates: z.boolean().optional(),
  push_new_messages: z.boolean().optional(),
  push_social_activity: z.boolean().optional(),
});

export type PushPrefsInput = z.infer<typeof pushPrefsSchema>;

// ============================================================
// TOUTES LES PRÉFÉRENCES (PUT global)
// ============================================================

export const allNotificationsSchema = z.object({
  // Email
  email_order_updates: z.boolean().optional(),
  email_new_messages: z.boolean().optional(),
  email_social_activity: z.boolean().optional(),
  email_marketing: z.boolean().optional(),

  // Push
  push_order_updates: z.boolean().optional(),
  push_new_messages: z.boolean().optional(),
  push_social_activity: z.boolean().optional(),
});

export type AllNotificationsInput = z.infer<typeof allNotificationsSchema>;
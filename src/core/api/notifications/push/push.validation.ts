import { z } from "zod";

// ============================================================
// SUBSCRIBE (enregistrer un token FCM)
// ============================================================

export const subscribePushSchema = z.object({
  token: z
    .string()
    .min(100, "Token FCM trop court")
    .max(500, "Token FCM trop long"),
  platform: z.enum(["ios", "android", "web"], {
    errorMap: () => ({
      message: "Platform invalide (ios, android ou web)",
    }),
  }),
  device_info: z
    .string()
    .max(255, "Device info trop long")
    .optional()
    .nullable(),
});

export type SubscribePushInput = z.infer<typeof subscribePushSchema>;

// ============================================================
// UNSUBSCRIBE (supprimer un token)
// ============================================================

export const unsubscribePushSchema = z.object({
  token: z.string().min(100, "Token FCM trop court"),
});

export type UnsubscribePushInput = z.infer<typeof unsubscribePushSchema>;
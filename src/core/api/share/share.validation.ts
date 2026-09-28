import { z } from "zod";

// ============================================================
// TYPES DE PARTAGE
// ============================================================

export const sharePlatformSchema = z.enum([
  "whatsapp",
  "sms",
  "twitter",
  "facebook",
  "telegram",
  "linkedin",
  "email",
  "instagram",
  "tiktok",
]);

export type SharePlatform = z.infer<typeof sharePlatformSchema>;
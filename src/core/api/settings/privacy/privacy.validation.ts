import { z } from "zod";

// ============================================================
// VISIBILITÉ DU PROFIL
// ============================================================

export const profileVisibilitySchema = z.object({
  profile_visibility: z.enum(["public", "friends", "private"], {
    errorMap: () => ({
      message: "Visibilité invalide (public, friends ou private)",
    }),
  }),
});

export type ProfileVisibilityInput = z.infer<typeof profileVisibilitySchema>;

// ============================================================
// QUI PEUT ENVOYER DES MESSAGES
// ============================================================

export const messagesFromSchema = z.object({
  allow_messages_from: z.enum(["everyone", "friends", "nobody"], {
    errorMap: () => ({
      message: "Valeur invalide (everyone, friends ou nobody)",
    }),
  }),
});

export type MessagesFromInput = z.infer<typeof messagesFromSchema>;

// ============================================================
// 🆕 SONNERIE D'APPEL
// ============================================================

export const callRingtoneSchema = z.enum(["nature", "classic", "silent"]);

export type CallRingtoneInput = z.infer<typeof callRingtoneSchema>;

// ============================================================
// TOUTES LES PRÉFÉRENCES DE CONFIDENTIALITÉ
// ============================================================

export const privacySchema = z.object({
  // Profil
  profile_visibility: z.enum(["public", "friends", "private"]).optional(),
  show_email: z.boolean().optional(),
  show_phone: z.boolean().optional(),
  search_indexable: z.boolean().optional(),

  // Messagerie — qui peut m'écrire
  allow_messages_from: z.enum(["everyone", "friends", "nobody"]).optional(),

  // 🆕 Messagerie avancée
  read_receipts: z.boolean().optional(),
  online_status_visibility: z.enum(["everyone", "friends", "nobody"]).optional(),
  typing_indicator: z.boolean().optional(),
  call_permissions: z.enum(["everyone", "friends", "nobody"]).optional(),

  // 🆕 Notifications messagerie
  notification_sound: z.boolean().optional(),
  call_ringtone: callRingtoneSchema.optional(),
});

export type PrivacyInput = z.infer<typeof privacySchema>;
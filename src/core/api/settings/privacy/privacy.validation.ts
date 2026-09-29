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
// TOUTES LES PRÉFÉRENCES DE CONFIDENTIALITÉ
// ============================================================

export const privacySchema = z.object({
  profile_visibility: z.enum(["public", "friends", "private"]).optional(),
  allow_messages_from: z.enum(["everyone", "friends", "nobody"]).optional(),
  show_email: z.boolean().optional(),
  show_phone: z.boolean().optional(),
  search_indexable: z.boolean().optional(),
});

export type PrivacyInput = z.infer<typeof privacySchema>;
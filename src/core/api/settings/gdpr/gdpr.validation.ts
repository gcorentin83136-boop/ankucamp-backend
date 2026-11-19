import { z } from "zod";

// ============================================================
// DEMANDE DE SUPPRESSION DE COMPTE
// ============================================================

export const requestDeletionSchema = z.object({
  password: z
    .string()
    .min(1, "Mot de passe requis pour confirmer la suppression"),
  reason: z
    .string()
    .max(500, "La raison ne peut pas dépasser 500 caractères")
    .optional()
    .nullable(),
});

export type RequestDeletionInput = z.infer<typeof requestDeletionSchema>;

// ============================================================
// ACCEPTATION D'UN DOCUMENT LÉGAL
// ============================================================

export const acceptLegalDocSchema = z.object({
  document_type: z.enum(["cgu", "privacy", "cookies", "cgv", "marketing"], {
    errorMap: () => ({
      message:
        "Type de document invalide (cgu, privacy, cookies, cgv, marketing)",
    }),
  }),
  document_version: z
    .string()
    .min(1, "Version requise")
    .max(20, "Version trop longue"),
});

export type AcceptLegalDocInput = z.infer<typeof acceptLegalDocSchema>;
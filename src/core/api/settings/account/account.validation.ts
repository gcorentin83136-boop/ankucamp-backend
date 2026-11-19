import { z } from "zod";

// ============================================================
// CHANGEMENT D'EMAIL
// ============================================================

export const changeEmailSchema = z.object({
  new_email: z
    .string()
    .email("Adresse email invalide")
    .max(255, "L'email est trop long"),
  password: z
    .string()
    .min(1, "Mot de passe requis pour confirmer le changement"),
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

// ============================================================
// CHANGEMENT DE MOT DE PASSE
// ============================================================

export const changePasswordSchema = z
  .object({
    current_password: z
      .string()
      .min(1, "Mot de passe actuel requis"),
    new_password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .max(100, "Le mot de passe est trop long")
      .regex(
        /(?=.*[a-z])/,
        "Le mot de passe doit contenir au moins une minuscule"
      )
      .regex(
        /(?=.*[A-Z])/,
        "Le mot de passe doit contenir au moins une majuscule"
      )
      .regex(
        /(?=.*\d)/,
        "Le mot de passe doit contenir au moins un chiffre"
      ),
    confirm_password: z.string().min(1, "Confirmation requise"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm_password"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================================
// CHANGEMENT DE USERNAME
// ============================================================

export const changeUsernameSchema = z.object({
  new_username: z
    .string()
    .min(3, "Le username doit contenir au moins 3 caractères")
    .max(30, "Le username ne peut pas dépasser 30 caractères")
    .regex(
      /^[a-z0-9_]+$/,
      "Le username ne peut contenir que des minuscules, chiffres et underscores"
    ),
  password: z
    .string()
    .min(1, "Mot de passe requis pour confirmer le changement"),
});

export type ChangeUsernameInput = z.infer<typeof changeUsernameSchema>;

// ============================================================
// MODIFICATION DES INFOS PERSONNELLES
// ============================================================

export const updateInfoSchema = z.object({
  first_name: z
    .string()
    .min(1, "Le prénom est requis")
    .max(100)
    .optional(),
  last_name: z
    .string()
    .min(1, "Le nom est requis")
    .max(100)
    .optional(),
  birth_year: z
    .number()
    .int()
    .min(1900, "Année invalide")
    .max(new Date().getFullYear(), "Année invalide")
    .optional(),
});

export type UpdateInfoInput = z.infer<typeof updateInfoSchema>;

// ============================================================
// DÉSACTIVATION DE COMPTE
// ============================================================

export const deactivateAccountSchema = z.object({
  password: z
    .string()
    .min(1, "Mot de passe requis pour confirmer la désactivation"),
  reason: z
    .string()
    .max(500, "La raison est trop longue")
    .optional()
    .nullable(),
});

export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
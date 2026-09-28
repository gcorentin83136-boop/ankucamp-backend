import { z } from "zod";

// ============================================================
// UPDATE PROFIL (nouveaux champs sociaux)
// ============================================================

export const updateProfileSchema = z.object({
  // Identité de base
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      "Le username doit faire 3-30 caractères (minuscules, chiffres, underscore uniquement)"
    )
    .optional(),
  email: z.string().email().optional(),
  birth_year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),

  // Adresse
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),

  // Profil public (nouveaux champs)
  bio: z.string().max(500, "La bio ne peut pas dépasser 500 caractères").optional().nullable(),
  website: z.string().url().max(255).optional().nullable().or(z.literal("")),
  location: z.string().max(255).optional().nullable(),
  cover_url: z.string().url().optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================================
// UPDATE PRIVACY
// ============================================================

export const updatePrivacySchema = z.object({
  is_private: z.boolean(),
});

export type UpdatePrivacyInput = z.infer<typeof updatePrivacySchema>;

// ============================================================
// PAGINATION
// ============================================================

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(100).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
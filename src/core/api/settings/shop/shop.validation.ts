import { z } from "zod";

// ============================================================
// MODE VACANCES
// ============================================================

export const vacationSchema = z.object({
  vacation_mode: z.boolean(),
  vacation_message: z
    .string()
    .max(500, "Le message ne peut pas dépasser 500 caractères")
    .optional()
    .nullable(),
  vacation_until: z
    .string()
    .datetime({ message: "Date invalide (format ISO 8601)" })
    .optional()
    .nullable(),
});

export type VacationInput = z.infer<typeof vacationSchema>;

// ============================================================
// MASQUER LA BOUTIQUE
// ============================================================

export const hiddenSchema = z.object({
  is_hidden: z.boolean(),
});

export type HiddenInput = z.infer<typeof hiddenSchema>;

// ============================================================
// RETOURS
// ============================================================

export const returnsSchema = z.object({
  accepts_returns: z.boolean(),
  return_days: z
    .number()
    .int()
    .min(0, "Doit être >= 0")
    .max(90, "Doit être <= 90")
    .optional(),
});

export type ReturnsInput = z.infer<typeof returnsSchema>;

// ============================================================
// CONTACT
// ============================================================

export const contactSchema = z.object({
  contact_phone: z
    .string()
    .max(30)
    .optional()
    .nullable(),
  contact_email: z
    .string()
    .email("Email invalide")
    .max(255)
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;

// ============================================================
// UPDATE GLOBAL
// ============================================================

export const shopSettingsSchema = z.object({
  vacation_mode: z.boolean().optional(),
  vacation_message: z.string().max(500).optional().nullable(),
  vacation_until: z.string().datetime().optional().nullable(),
  is_hidden: z.boolean().optional(),
  accepts_returns: z.boolean().optional(),
  return_days: z.number().int().min(0).max(90).optional(),
  contact_phone: z.string().max(30).optional().nullable(),
  contact_email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  shipping_zones: z.array(z.string()).optional().nullable(),
});

export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;
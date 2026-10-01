import { z } from "zod";

export const KYC_TYPES = [
  "agriculteur",
  "artisan",
  "createur",
  "autre",
] as const;
export type KycType = (typeof KYC_TYPES)[number];

export const KYC_STATUSES = ["pending", "approved", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const BADGES = [
  "verified",
  "agriculteur",
  "artisan",
  "createur",
  "bio",
  "producteur_local",
] as const;
export type BadgeType = (typeof BADGES)[number];

export const createKycSchema = z.object({
  type: z.enum(KYC_TYPES),
  siret: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => /^\d{14}$/.test(v), "Le SIRET doit contenir 14 chiffres"),
  documents: z
    .array(z.string().url("Chaque document doit etre une URL valide"))
    .min(1, "Au moins 1 document est requis")
    .max(5, "Maximum 5 documents"),
});
export type CreateKycInput = z.infer<typeof createKycSchema>;

export const rejectKycSchema = z.object({
  reason: z
    .string()
    .min(10, "Le motif doit faire au moins 10 caracteres")
    .max(1000, "Le motif ne peut pas depasser 1000 caracteres"),
});
export type RejectKycInput = z.infer<typeof rejectKycSchema>;

export const listKycQuerySchema = z.object({
  status: z.enum(["all", ...KYC_STATUSES]).default("pending"),
  type: z.enum(["all", ...KYC_TYPES]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListKycQuery = z.infer<typeof listKycQuerySchema>;

export const grantBadgeSchema = z.object({
  badge: z.enum(BADGES),
});
export type GrantBadgeInput = z.infer<typeof grantBadgeSchema>;

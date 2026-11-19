import { z } from "zod";

// ============================================================
// DEMANDE DE REMBOURSEMENT (buyer)
// ============================================================

export const requestRefundSchema = z.object({
  order_id: z
    .number()
    .int()
    .positive("order_id doit être un entier positif"),
  reason: z
    .string()
    .min(10, "La raison doit contenir au moins 10 caractères")
    .max(1000, "La raison ne peut pas dépasser 1000 caractères"),
});

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;

// ============================================================
// APPROBATION / REJET (admin)
// ============================================================

export const processRefundSchema = z.object({
  admin_comment: z
    .string()
    .max(1000, "Le commentaire ne peut pas dépasser 1000 caractères")
    .optional()
    .nullable(),
});

export type ProcessRefundInput = z.infer<typeof processRefundSchema>;

// ============================================================
// LISTE (pagination)
// ============================================================

export const listRefundsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z
    .enum(["pending", "approved", "rejected", "refunded", "failed"])
    .optional(),
});

export type ListRefundsQuery = z.infer<typeof listRefundsQuerySchema>;
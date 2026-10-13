import { z } from "zod";

// ============================================================
// PAGINATION (query commune pour les listes)
// ============================================================

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ============================================================
// CHART PERIOD (12 derniers mois par défaut)
// ============================================================

export const chartPeriodSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

export type ChartPeriodQuery = z.infer<typeof chartPeriodSchema>;

// ============================================================
// PÉRIODE POUR LES STATS VENDEUR (7d / 30d / 6m / 12m)
// ============================================================

export const periodSchema = z.object({
  period: z.enum(["7d", "30d", "6m", "12m"]).default("30d"),
});

export type PeriodInput = z.infer<typeof periodSchema>;
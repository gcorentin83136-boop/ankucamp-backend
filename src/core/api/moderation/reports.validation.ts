import { z } from "zod";

export const REPORT_TARGET_TYPES = [
  "post",
  "comment",
  "review",
  "product",
  "shop",
  "user",
  "message",
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate_speech",
  "violence",
  "copyright",
  "fake",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["pending", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const createReportSchema = z.object({
  target_type: z.enum(REPORT_TARGET_TYPES),
  target_id: z.number().int().positive(),
  reason: z.enum(REPORT_REASONS),
  description: z
    .string()
    .max(1000, "La description ne peut pas dépasser 1000 caractères")
    .optional()
    .nullable(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const listReportsQuerySchema = z.object({
  status: z.enum(["all", ...REPORT_STATUSES]).default("pending"),
  target_type: z.enum(["all", ...REPORT_TARGET_TYPES]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;

export const resolveReportSchema = z.object({
  admin_note: z
    .string()
    .max(1000, "La note ne peut pas dépasser 1000 caractères")
    .optional()
    .nullable(),
  delete_content: z.boolean().default(true),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

export const dismissReportSchema = z.object({
  admin_note: z
    .string()
    .max(1000)
    .min(10, "Explique pourquoi tu rejettes ce signalement (min 10 car.)"),
});
export type DismissReportInput = z.infer<typeof dismissReportSchema>;
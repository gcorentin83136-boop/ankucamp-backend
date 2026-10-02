import { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "./audit.helper";

export const listAuditLogsQuerySchema = z.object({
  admin_id: z.coerce.number().int().positive().optional(),
  action: z.enum(["all", ...AUDIT_ACTIONS]).default("all"),
  target_type: z.enum(["all", ...AUDIT_TARGET_TYPES]).default("all"),
  target_id: z.coerce.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
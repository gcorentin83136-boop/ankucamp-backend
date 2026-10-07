import { db } from "../../db";
import { auditLogs } from "../../db/schema";
import { logger } from "../../../config/logger";

// ============================================================
// TYPES
// ============================================================

export const AUDIT_ACTIONS = [
  "kyc_approve",
  "kyc_reject",
  "report_resolve",
  "report_dismiss",
  "review_resolve",
  "review_dismiss",
  "refund_approve",
  "refund_reject",
  "badge_grant",
  "badge_revoke",
  "category_create",
  "category_update",
  "category_delete",
  "promo_create",
  "promo_update",
  "promo_delete",
  "user_ban",
  "user_delete",
  "event_cancel",
  "backup_run",
  "other",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = [
  "user",
  "shop",
  "product",
  "review",
  "kyc",
  "report",
  "refund",
  "badge",
  "category",
  "promo",
  "event",
  "post",
  "comment",
  "message",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export interface LogAdminActionInput {
  adminId: number;
  action: AuditAction;
  targetType?: AuditTargetType | null;
  targetId?: number | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ============================================================
// CORE
// ============================================================

export async function logAdminAction(
  input: LogAdminActionInput
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      admin_id: input.adminId,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (err) {
    logger.error(
      { err, input },
      "❌ Erreur enregistrement audit log (non bloquant)"
    );
  }
}

export function logAdminActionAsync(input: LogAdminActionInput): void {
  logAdminAction(input).catch((err) =>
    logger.error({ err }, "❌ Erreur async audit log")
  );
}
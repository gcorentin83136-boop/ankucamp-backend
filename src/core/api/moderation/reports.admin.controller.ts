import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  listReportsQuerySchema,
  resolveReportSchema,
  dismissReportSchema,
} from "./reports.validation";
import {
  listReports,
  getReportById,
  resolveReport,
  dismissReport,
  getReportsStats,
  listFlaggedReviews,
  resolveFlaggedReview,
  dismissFlaggedReview,
} from "./reports.service";
import { logAdminActionAsync } from "../audit/audit.helper";

export async function adminListReports(req: AuthRequest, res: Response) {
  const parsed = listReportsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Query invalide",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const reports = await listReports(parsed.data);
  return res.json({ success: true, count: reports.length, reports });
}

export async function adminGetReport(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
  const report = await getReportById(id);
  return res.json({ success: true, report });
}

export async function adminResolveReport(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = resolveReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await resolveReport(
    id,
    req.user.id,
    parsed.data.admin_note ?? null,
    parsed.data.delete_content
  );

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "report_resolve",
    targetType: "report",
    targetId: id,
    description: `Signalement #${id} résolu${result.content_deleted ? " (contenu supprimé)" : ""}`,
    metadata: {
      content_deleted: result.content_deleted,
      admin_note: parsed.data.admin_note ?? null,
    },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json(result);
}

export async function adminDismissReport(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = dismissReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await dismissReport(id, req.user.id, parsed.data.admin_note);

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "report_dismiss",
    targetType: "report",
    targetId: id,
    description: `Signalement #${id} rejeté — Motif: ${parsed.data.admin_note}`,
    metadata: { admin_note: parsed.data.admin_note },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json(result);
}

export async function adminReportsStats(_req: AuthRequest, res: Response) {
  const result = await getReportsStats();
  return res.json({
    success: true,
    pending: result.stats.pending,
    resolved: result.stats.resolved,
    dismissed: result.stats.dismissed,
    total: result.stats.total,
    by_type: result.by_type,
  });
}

// ============================================================
// AVIS SIGNALÉS (is_flagged = 1)
// ============================================================

export async function adminListFlaggedReviews(
  req: AuthRequest,
  res: Response
) {
  const statusQuery = req.query.status;
  const status =
    typeof statusQuery === "string" &&
    ["pending", "resolved", "dismissed", "all"].includes(statusQuery)
      ? (statusQuery as "pending" | "resolved" | "dismissed" | "all")
      : "pending";

  const list = await listFlaggedReviews(status);
  return res.json({ success: true, count: list.length, reviews: list });
}

export async function adminResolveReview(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const deleteContent =
    typeof req.body?.delete_content === "boolean"
      ? req.body.delete_content
      : false;

  const result = await resolveFlaggedReview(id, req.user.id, deleteContent);

  logAdminActionAsync({
    adminId: req.user.id,
    action: "review_resolve",
    targetType: "review",
    targetId: id,
    description: `Avis #${id} résolu${result.content_deleted ? " (supprimé)" : ""}`,
    metadata: { content_deleted: result.content_deleted },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json(result);
}

export async function adminDismissReview(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const result = await dismissFlaggedReview(id, req.user.id);

  logAdminActionAsync({
    adminId: req.user.id,
    action: "review_dismiss",
    targetType: "review",
    targetId: id,
    description: `Avis #${id} rejeté (conservé)`,
    metadata: null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json(result);
}
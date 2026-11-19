import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { listAuditLogsQuerySchema } from "./audit.validation";
import { listAuditLogs, getAuditStats } from "./audit.service";

// ============================================================
// GET /admin/audit/logs
// ============================================================

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listAuditLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const logs = await listAuditLogs(parsed.data);

  return res.json({
    success: true,
    count: logs.length,
    logs,
  });
}

// ============================================================
// GET /admin/audit/stats
// ============================================================

export async function stats(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const result = await getAuditStats();

  return res.json({
    success: true,
    ...result,
  });
}
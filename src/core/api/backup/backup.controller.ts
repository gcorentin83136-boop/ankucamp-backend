import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { runBackup, listBackups, getBackupStats } from "./backup.service";
import { logAdminActionAsync } from "../audit/audit.helper";

// ============================================================
// POST /admin/backup/run
// ============================================================

export async function run(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const result = await runBackup();

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "backup_run",
    targetType: null,
    targetId: null,
    description: `Backup manuel : ${result.filename} (${(result.size_bytes / 1024 / 1024).toFixed(2)} MB)`,
    metadata: {
      kind: "backup_run",
      filename: result.filename,
      size_bytes: result.size_bytes,
      duration_ms: result.duration_ms,
      deleted: result.deleted,
    },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json({
    success: true,
    message: "Backup créé avec succès",
    ...result,
  });
}

// ============================================================
// GET /admin/backup/list
// ============================================================

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const backups = await listBackups();

  return res.json({
    success: true,
    count: backups.length,
    backups,
  });
}

// ============================================================
// GET /admin/backup/stats
// ============================================================

export async function stats(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const result = await getBackupStats();

  return res.json({ success: true, ...result });
}
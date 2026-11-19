import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { AppError } from "../../errors/AppError";

const DEFAULT_BACKUP_DIR = path.resolve(process.cwd(), "backups");

// ============================================================
// HELPERS
// ============================================================

function getBackupDir(): string {
  return env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : DEFAULT_BACKUP_DIR;
}

function getRetentionDays(): number {
  return env.BACKUP_RETENTION_DAYS ?? 30;
}

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export async function ensureBackupDir(): Promise<string> {
  const dir = getBackupDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// ============================================================
// ROTATION
// ============================================================

export async function applyRetention(): Promise<number> {
  const dir = getBackupDir();
  const retentionDays = getRetentionDays();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  let deleted = 0;
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.startsWith("ankucamp-") || !file.endsWith(".dump")) continue;

      const filepath = path.join(dir, file);
      const stat = await fs.stat(filepath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(filepath);
        deleted++;
      }
    }
  } catch (err) {
    logger.error({ err }, "Erreur rotation backups");
  }
  return deleted;
}

// ============================================================
// RUN BACKUP
// ============================================================

export async function runBackup(): Promise<{
  filename: string;
  path: string;
  size_bytes: number;
  duration_ms: number;
  deleted: number;
}> {
  const dir = await ensureBackupDir();
  const filename = `ankucamp-${formatTimestamp()}.dump`;
  const filepath = path.join(dir, filename);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new AppError("DATABASE_URL manquant dans .env", 500);

  const db = parseDatabaseUrl(dbUrl);
  const start = Date.now();

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-h", db.host,
      "-p", db.port,
      "-U", db.user,
      "-d", db.database,
      "-Fc", // format custom (compressé)
      "-f", filepath,
    ];

    const proc = spawn("pg_dump", args, {
      env: { ...process.env, PGPASSWORD: db.password },
    });

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(
        new AppError(
          `Impossible de lancer pg_dump. Vérifie qu'il est installé et dans le PATH. Erreur : ${err.message}`,
          500
        )
      );
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new AppError(`pg_dump a échoué (code ${code}) : ${stderr}`, 500)
        );
      }
    });
  });

  const duration_ms = Date.now() - start;
  const stat = await fs.stat(filepath);

  // Rotation auto
  const deleted = await applyRetention();

  logger.info(
    { filename, size: stat.size, duration_ms, deleted },
    "💾 Backup créé"
  );

  return {
    filename,
    path: filepath,
    size_bytes: stat.size,
    duration_ms,
    deleted,
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function listBackups(): Promise<
  Array<{ filename: string; size_bytes: number; created_at: Date }>
> {
  const dir = getBackupDir();

  try {
    const files = await fs.readdir(dir);
    const backups: Array<{
      filename: string;
      size_bytes: number;
      created_at: Date;
    }> = [];

    for (const file of files) {
      if (!file.startsWith("ankucamp-") || !file.endsWith(".dump")) continue;

      const filepath = path.join(dir, file);
      const stat = await fs.stat(filepath);
      backups.push({
        filename: file,
        size_bytes: stat.size,
        created_at: stat.mtime,
      });
    }

    return backups.sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime()
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function getBackupStats() {
  const backups = await listBackups();
  const total_size_bytes = backups.reduce((sum, b) => sum + b.size_bytes, 0);
  const last = backups[0] ?? null;

  return {
    count: backups.length,
    total_size_bytes,
    total_size_mb: Number((total_size_bytes / 1024 / 1024).toFixed(2)),
    last_backup: last
      ? {
          filename: last.filename,
          size_bytes: last.size_bytes,
          size_mb: Number((last.size_bytes / 1024 / 1024).toFixed(2)),
          created_at: last.created_at,
        }
      : null,
    retention_days: getRetentionDays(),
    backup_dir: getBackupDir(),
  };
}
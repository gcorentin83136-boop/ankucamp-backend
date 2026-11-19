import { describe, it, expect } from "vitest";
import {
  getBackupStats,
  listBackups,
} from "../../src/core/api/backup/backup.service";

describe("backup service", () => {
  it("listBackups retourne un tableau", async () => {
    const backups = await listBackups();
    expect(Array.isArray(backups)).toBe(true);
  });

  it("getBackupStats retourne les bonnes clés", async () => {
    const stats = await getBackupStats();
    expect(stats).toHaveProperty("count");
    expect(stats).toHaveProperty("total_size_bytes");
    expect(stats).toHaveProperty("total_size_mb");
    expect(stats).toHaveProperty("last_backup");
    expect(stats).toHaveProperty("retention_days");
    expect(stats).toHaveProperty("backup_dir");
    expect(typeof stats.count).toBe("number");
    expect(typeof stats.retention_days).toBe("number");
  });

  it("listBackups est trié par date desc", async () => {
    const backups = await listBackups();
    for (let i = 0; i < backups.length - 1; i++) {
      expect(backups[i].created_at.getTime()).toBeGreaterThanOrEqual(
        backups[i + 1].created_at.getTime()
      );
    }
  });

  it("count = taille du tableau listBackups", async () => {
    const backups = await listBackups();
    const stats = await getBackupStats();
    expect(stats.count).toBe(backups.length);
  });
});
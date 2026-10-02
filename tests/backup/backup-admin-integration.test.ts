import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser } from "../helpers/factories";

describe("Backup admin integration", () => {
  // ============================================================
  // GET /admin/backup/list
  // ============================================================

  describe("GET /admin/backup/list", () => {
    it("refuse si non admin (403)", async () => {
      const user = await createUser({ email: "backup-user@test.com" });

      const res = await request(app)
        .get("/admin/backup/list")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(403);
    });

    it("refuse si non authentifié (401)", async () => {
      const res = await request(app).get("/admin/backup/list");
      expect(res.status).toBe(401);
    });

    it("retourne la liste des backups (peut être vide)", async () => {
      const admin = await createUser({
        email: "backup-admin1@test.com",
        role: "admin",
      });

      const res = await request(app)
        .get("/admin/backup/list")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.backups)).toBe(true);
      expect(typeof res.body.count).toBe("number");
    });
  });

  // ============================================================
  // GET /admin/backup/stats
  // ============================================================

  describe("GET /admin/backup/stats", () => {
    it("retourne les stats (count, total_size_mb, retention_days, backup_dir)", async () => {
      const admin = await createUser({
        email: "backup-admin2@test.com",
        role: "admin",
      });

      const res = await request(app)
        .get("/admin/backup/stats")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("count");
      expect(res.body).toHaveProperty("total_size_bytes");
      expect(res.body).toHaveProperty("total_size_mb");
      expect(res.body).toHaveProperty("retention_days");
      expect(res.body).toHaveProperty("backup_dir");
      expect(typeof res.body.retention_days).toBe("number");
    });

    it("refuse si non admin (403)", async () => {
      const user = await createUser({ email: "backup-user2@test.com" });

      const res = await request(app)
        .get("/admin/backup/stats")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(403);
    });
  });
});
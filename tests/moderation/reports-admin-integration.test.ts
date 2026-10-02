import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { testDb } from "../helpers/testSetup";
import "../helpers/testSetup";
import { createUser } from "../helpers/factories";
import { posts } from "../../src/core/db/schema";
import { eq } from "drizzle-orm";

describe("Reports admin integration", () => {
  async function setup() {
    const admin = await createUser({
      email: `admin-rep-${Date.now()}@test.com`,
      role: "admin",
    });
    const reporter = await createUser({
      email: `reporter-${Date.now()}@test.com`,
    });
    const author = await createUser({
      email: `author-${Date.now()}@test.com`,
    });

    const [post] = await testDb
      .insert(posts)
      .values({
        author_id: author.id,
        content: "Post à signaler",
        visibility: "public",
      })
      .returning();

    return { admin, reporter, author, post };
  }

  // ============================================================
  // CRÉATION DE SIGNALEMENTS
  // ============================================================

  describe("POST /reports", () => {
    it("crée un signalement (201)", async () => {
      const { reporter, post } = await setup();

      const res = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({
          target_type: "post",
          target_id: post.id,
          reason: "spam",
          description: "Ce post est du spam",
        });

      expect(res.status).toBe(201);
      expect(res.body.report.id).toBeTruthy();
      expect(res.body.report.status).toBe("pending");
    });

    it("refuse auto-signalement (400)", async () => {
      const { author, post } = await setup();

      const res = await request(app)
        .post("/reports")
        .set("Authorization", author.authorization)
        .send({
          target_type: "post",
          target_id: post.id,
          reason: "spam",
        });

      expect(res.status).toBe(400);
    });

    it("refuse doublon (409)", async () => {
      const { reporter, post } = await setup();

      await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({
          target_type: "post",
          target_id: post.id,
          reason: "spam",
        });

      const res = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({
          target_type: "post",
          target_id: post.id,
          reason: "harassment",
        });

      expect(res.status).toBe(409);
    });

    it("refuse cible inexistante (404)", async () => {
      const { reporter } = await setup();

      const res = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({
          target_type: "post",
          target_id: 999999,
          reason: "spam",
        });

      expect(res.status).toBe(404);
    });

    it("refuse si non authentifié (401)", async () => {
      const res = await request(app)
        .post("/reports")
        .send({ target_type: "post", target_id: 1, reason: "spam" });
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // ADMIN — LIST
  // ============================================================

  describe("GET /admin/moderation/reports", () => {
    it("liste les signalements pending", async () => {
      const { admin, reporter, post } = await setup();

      await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({ target_type: "post", target_id: post.id, reason: "spam" });

      const res = await request(app)
        .get("/admin/moderation/reports")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.reports.length).toBe(1);
      expect(res.body.reports[0].status).toBe("pending");
    });

    it("refuse si non-admin (403)", async () => {
      const { reporter } = await setup();

      const res = await request(app)
        .get("/admin/moderation/reports")
        .set("Authorization", reporter.authorization);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /admin/moderation/reports/stats", () => {
    it("retourne les compteurs", async () => {
      const { admin, reporter, post } = await setup();

      await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({ target_type: "post", target_id: post.id, reason: "spam" });

      const res = await request(app)
        .get("/admin/moderation/reports/stats")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.stats.pending).toBe(1);
      expect(res.body.stats.total).toBe(1);
    });
  });

  // ============================================================
  // ADMIN — RESOLVE
  // ============================================================

  describe("PUT /admin/moderation/reports/:id/resolve", () => {
    it("résout + supprime le contenu (delete_content=true par défaut)", async () => {
      const { admin, reporter, post } = await setup();

      const createRes = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({ target_type: "post", target_id: post.id, reason: "spam" });

      const reportId = createRes.body.report.id;

      const res = await request(app)
        .put(`/admin/moderation/reports/${reportId}/resolve`)
        .set("Authorization", admin.authorization)
        .send({ admin_note: "Contenu supprimé après examen." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content_deleted).toBe(true);

      // Vérifie que le post est supprimé
      const [postAfter] = await testDb
        .select()
        .from(posts)
        .where(eq(posts.id, post.id));
      expect(postAfter).toBeUndefined();
    });

    it("résout SANS supprimer (delete_content=false)", async () => {
      const { admin, reporter, post } = await setup();

      const createRes = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({ target_type: "post", target_id: post.id, reason: "spam" });

      const reportId = createRes.body.report.id;

      const res = await request(app)
        .put(`/admin/moderation/reports/${reportId}/resolve`)
        .set("Authorization", admin.authorization)
        .send({
          admin_note: "Faux positif, contenu conservé.",
          delete_content: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.content_deleted).toBe(false);

      // Vérifie que le post existe toujours
      const [postAfter] = await testDb
        .select()
        .from(posts)
        .where(eq(posts.id, post.id));
      expect(postAfter).toBeDefined();
    });

    it("409 si déjà traité", async () => {
      const { admin, reporter, post } = await setup();

      const createRes = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({ target_type: "post", target_id: post.id, reason: "spam" });

      const reportId = createRes.body.report.id;

      await request(app)
        .put(`/admin/moderation/reports/${reportId}/resolve`)
        .set("Authorization", admin.authorization)
        .send({ delete_content: false });

      const res = await request(app)
        .put(`/admin/moderation/reports/${reportId}/resolve`)
        .set("Authorization", admin.authorization)
        .send({ delete_content: false });

      expect(res.status).toBe(409);
    });
  });

  // ============================================================
  // ADMIN — DISMISS
  // ============================================================

  describe("PUT /admin/moderation/reports/:id/dismiss", () => {
    it("rejette avec un motif", async () => {
      const { admin, reporter, post } = await setup();

      const createRes = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({ target_type: "post", target_id: post.id, reason: "spam" });

      const reportId = createRes.body.report.id;

      const res = await request(app)
        .put(`/admin/moderation/reports/${reportId}/dismiss`)
        .set("Authorization", admin.authorization)
        .send({ admin_note: "Aucune infraction constatée, signalement abusif." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Vérifie que le post existe toujours
      const [postAfter] = await testDb
        .select()
        .from(posts)
        .where(eq(posts.id, post.id));
      expect(postAfter).toBeDefined();
    });

    it("400 si motif trop court (<10 car.)", async () => {
      const { admin, reporter, post } = await setup();

      const createRes = await request(app)
        .post("/reports")
        .set("Authorization", reporter.authorization)
        .send({ target_type: "post", target_id: post.id, reason: "spam" });

      const res = await request(app)
        .put(`/admin/moderation/reports/${createRes.body.report.id}/dismiss`)
        .set("Authorization", admin.authorization)
        .send({ admin_note: "Nope" });

      expect(res.status).toBe(400);
    });
  });
});
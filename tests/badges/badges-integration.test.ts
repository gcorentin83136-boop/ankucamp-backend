import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser } from "../helpers/factories";

describe("Badges integration", () => {
  // ============================================================
  // LECTURE PUBLIQUE
  // ============================================================

  describe("GET /users/:id/badges", () => {
    it("retourne [] si l'user n'a aucun badge", async () => {
      const user = await createUser({ email: "badge1@test.com" });

      const res = await request(app).get(`/users/${user.id}/badges`);

      expect(res.status).toBe(200);
      expect(res.body.badges).toEqual([]);
    });
  });

  // ============================================================
  // ADMIN — GRANT
  // ============================================================

  describe("POST /users/:id/badges", () => {
    it("attribue un badge (201)", async () => {
      const admin = await createUser({
        email: "admin-badge@test.com",
        role: "admin",
      });
      const user = await createUser({ email: "user-badge1@test.com" });

      const res = await request(app)
        .post(`/users/${user.id}/badges`)
        .set("Authorization", admin.authorization)
        .send({ badge: "agriculteur" });

      expect(res.status).toBe(201);
      expect(res.body.badge.badge).toBe("agriculteur");
      expect(res.body.badge.user_id).toBe(user.id);
    });

    it("refuse un badge inconnu (400)", async () => {
      const admin = await createUser({
        email: "admin-badge2@test.com",
        role: "admin",
      });
      const user = await createUser({ email: "user-badge2@test.com" });

      const res = await request(app)
        .post(`/users/${user.id}/badges`)
        .set("Authorization", admin.authorization)
        .send({ badge: "hacker" });

      expect(res.status).toBe(400);
    });

    it("refuse doublon (409)", async () => {
      const admin = await createUser({
        email: "admin-badge3@test.com",
        role: "admin",
      });
      const user = await createUser({ email: "user-badge3@test.com" });

      await request(app)
        .post(`/users/${user.id}/badges`)
        .set("Authorization", admin.authorization)
        .send({ badge: "bio" });

      const res = await request(app)
        .post(`/users/${user.id}/badges`)
        .set("Authorization", admin.authorization)
        .send({ badge: "bio" });

      expect(res.status).toBe(409);
    });

    it("refuse si non-admin (403)", async () => {
      const user = await createUser({ email: "user-badge4@test.com" });
      const other = await createUser({ email: "other-badge4@test.com" });

      const res = await request(app)
        .post(`/users/${user.id}/badges`)
        .set("Authorization", other.authorization)
        .send({ badge: "artisan" });

      expect(res.status).toBe(403);
    });

    it("badge visible ensuite dans GET /users/:id/badges", async () => {
      const admin = await createUser({
        email: "admin-badge5@test.com",
        role: "admin",
      });
      const user = await createUser({ email: "user-badge5@test.com" });

      await request(app)
        .post(`/users/${user.id}/badges`)
        .set("Authorization", admin.authorization)
        .send({ badge: "createur" });

      const res = await request(app).get(`/users/${user.id}/badges`);
      expect(res.body.badges).toContain("createur");
    });
  });

  // ============================================================
  // ADMIN — REVOKE
  // ============================================================

  describe("DELETE /users/:id/badges/:badge", () => {
    it("révoque un badge (200)", async () => {
      const admin = await createUser({
        email: "admin-badge6@test.com",
        role: "admin",
      });
      const user = await createUser({ email: "user-badge6@test.com" });

      await request(app)
        .post(`/users/${user.id}/badges`)
        .set("Authorization", admin.authorization)
        .send({ badge: "producteur_local" });

      const res = await request(app)
        .delete(`/users/${user.id}/badges/producteur_local`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Vérifie qu'il n'apparaît plus dans la liste
      const listRes = await request(app).get(`/users/${user.id}/badges`);
      expect(listRes.body.badges).not.toContain("producteur_local");
    });

    it("404 si badge pas actif", async () => {
      const admin = await createUser({
        email: "admin-badge7@test.com",
        role: "admin",
      });
      const user = await createUser({ email: "user-badge7@test.com" });

      const res = await request(app)
        .delete(`/users/${user.id}/badges/verified`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(404);
    });

    it("400 si badge inconnu", async () => {
      const admin = await createUser({
        email: "admin-badge8@test.com",
        role: "admin",
      });
      const user = await createUser({ email: "user-badge8@test.com" });

      const res = await request(app)
        .delete(`/users/${user.id}/badges/banana`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(400);
    });
  });
});
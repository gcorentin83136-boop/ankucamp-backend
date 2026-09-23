import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import "./helpers/testSetup";
import { createUser } from "./helpers/factories";
import { testDb } from "./helpers/testSetup";
import { notifications } from "../src/core/db/schema";

describe("Notifications module", () => {
  // Helper : créer une notif directement en DB
  async function createNotification(userId: number, title = "Test", content = "Contenu") {
    const [notif] = await testDb
      .insert(notifications)
      .values({ user_id: userId, title, content, is_read: 0 })
      .returning();
    return notif;
  }

  // ============================================================
  // GET /notifications/me
  // ============================================================
  describe("GET /notifications/me", () => {
    it("refuse sans token (401)", async () => {
      const res = await request(app).get("/notifications/me");
      expect(res.status).toBe(401);
    });

    it("retourne une liste vide au départ", async () => {
      const user = await createUser({ email: "user@test.com" });

      const res = await request(app)
        .get("/notifications/me")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toEqual([]);
    });

    it("retourne uniquement les notifications de l'utilisateur connecté", async () => {
      const user1 = await createUser({ email: "user1@test.com" });
      const user2 = await createUser({ email: "user2@test.com" });

      await createNotification(user1.id, "Pour user1");
      await createNotification(user2.id, "Pour user2");
      await createNotification(user1.id, "Pour user1 bis");

      const res = await request(app)
        .get("/notifications/me")
        .set("Authorization", user1.authorization);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(2);
      expect(res.body.notifications.every((n: any) => n.user_id === user1.id)).toBe(true);
    });
  });

  // ============================================================
  // PUT /notifications/:id/read
  // ============================================================
  describe("PUT /notifications/:id/read", () => {
    it("marque une notification comme lue", async () => {
      const user = await createUser({ email: "user@test.com" });
      const notif = await createNotification(user.id);

      const res = await request(app)
        .put(`/notifications/${notif.id}/read`)
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.notification.is_read).toBe(1);
    });

    it("refuse de marquer la notification d'un autre user (404)", async () => {
      const user1 = await createUser({ email: "user1@test.com" });
      const user2 = await createUser({ email: "user2@test.com" });
      const notif = await createNotification(user1.id);

      const res = await request(app)
        .put(`/notifications/${notif.id}/read`)
        .set("Authorization", user2.authorization);

      expect(res.status).toBe(404);
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app).put("/notifications/1/read");
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // PUT /notifications/read-all
  // ============================================================
  describe("PUT /notifications/read-all", () => {
    it("marque toutes les notifications de l'utilisateur comme lues", async () => {
      const user = await createUser({ email: "user@test.com" });
      await createNotification(user.id);
      await createNotification(user.id);
      await createNotification(user.id);

      const res = await request(app)
        .put("/notifications/read-all")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });
  });

  // ============================================================
  // DELETE /notifications/:id
  // ============================================================
  describe("DELETE /notifications/:id", () => {
    it("supprime une notification (204)", async () => {
      const user = await createUser({ email: "user@test.com" });
      const notif = await createNotification(user.id);

      const res = await request(app)
        .delete(`/notifications/${notif.id}`)
        .set("Authorization", user.authorization);

      expect(res.status).toBe(204);
    });

    it("refuse de supprimer la notification d'un autre (404)", async () => {
      const user1 = await createUser({ email: "user1@test.com" });
      const user2 = await createUser({ email: "user2@test.com" });
      const notif = await createNotification(user1.id);

      const res = await request(app)
        .delete(`/notifications/${notif.id}`)
        .set("Authorization", user2.authorization);

      expect(res.status).toBe(404);
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app).delete("/notifications/1");
      expect(res.status).toBe(401);
    });
  });
});
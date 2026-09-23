import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import "./helpers/testSetup";
import { createUser, createShop } from "./helpers/factories";

describe("Shops module", () => {
  // ============================================================
  // GET /shops — public
  // ============================================================
  describe("GET /shops", () => {
    it("retourne une liste vide au départ", async () => {
      const res = await request(app).get("/shops");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.shops).toEqual([]);
    });

    it("retourne les boutiques existantes", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      await createShop({ owner_id: pro.id, name: "Boutique A" });
      await createShop({ owner_id: pro.id, name: "Boutique B" });

      const res = await request(app).get("/shops");

      expect(res.status).toBe(200);
      expect(res.body.shops).toHaveLength(2);
    });
  });

  // ============================================================
  // GET /shops/:id — public
  // ============================================================
  describe("GET /shops/:id", () => {
    it("retourne une boutique existante", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id, name: "Chez Pro" });

      const res = await request(app).get(`/shops/${shop.id}`);

      expect(res.status).toBe(200);
      expect(res.body.shop.name).toBe("Chez Pro");
    });

    it("retourne 404 si la boutique n'existe pas", async () => {
      const res = await request(app).get("/shops/9999");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Boutique introuvable");
    });

    it("retourne 400 si l'ID n'est pas un nombre", async () => {
      const res = await request(app).get("/shops/abc");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("ID invalide");
    });
  });

  // ============================================================
  // POST /shops — protégé + rôle pro
  // ============================================================
  describe("POST /shops", () => {
    it("refuse sans token (401)", async () => {
      const res = await request(app)
        .post("/shops")
        .send({ name: "Ma boutique" });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Token manquant");
    });

    it("refuse un particulier (403)", async () => {
      const particulier = await createUser({
        email: "part@test.com",
        role: "particulier",
      });

      const res = await request(app)
        .post("/shops")
        .set("Authorization", particulier.authorization)
        .send({ name: "Ma boutique" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Accès interdit");
    });

    it("crée une boutique pour un professionnel (201)", async () => {
      const pro = await createUser({
        email: "pro@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .post("/shops")
        .set("Authorization", pro.authorization)
        .send({
          name: "Chez Pro",
          description: "Une super boutique",
          city: "Lyon",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.shop.name).toBe("Chez Pro");
      expect(res.body.shop.owner_id).toBe(pro.id);
    });

    it("refuse un nom trop court (400)", async () => {
      const pro = await createUser({
        email: "pro@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .post("/shops")
        .set("Authorization", pro.authorization)
        .send({ name: "A" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Données invalides");
    });
  });

  // ============================================================
  // GET /shops/owner/me
  // ============================================================
  describe("GET /shops/owner/me", () => {
    it("retourne uniquement les boutiques de l'utilisateur connecté", async () => {
      const pro1 = await createUser({ email: "pro1@test.com", role: "professionnel" });
      const pro2 = await createUser({ email: "pro2@test.com", role: "professionnel" });

      await createShop({ owner_id: pro1.id, name: "Shop 1" });
      await createShop({ owner_id: pro1.id, name: "Shop 2" });
      await createShop({ owner_id: pro2.id, name: "Shop de pro2" });

      const res = await request(app)
        .get("/shops/owner/me")
        .set("Authorization", pro1.authorization);

      expect(res.status).toBe(200);
      expect(res.body.shops).toHaveLength(2);
      expect(res.body.shops.every((s: any) => s.owner_id === pro1.id)).toBe(true);
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app).get("/shops/owner/me");

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // PUT /shops/:id — ownership
  // ============================================================
  describe("PUT /shops/:id", () => {
    it("permet au propriétaire de modifier sa boutique", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id, name: "Ancien nom" });

      const res = await request(app)
        .put(`/shops/${shop.id}`)
        .set("Authorization", pro.authorization)
        .send({ name: "Nouveau nom" });

      expect(res.status).toBe(200);
      expect(res.body.shop.name).toBe("Nouveau nom");
    });

    it("refuse si l'utilisateur n'est pas le propriétaire (403)", async () => {
      const pro1 = await createUser({ email: "pro1@test.com", role: "professionnel" });
      const pro2 = await createUser({ email: "pro2@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro1.id });

      const res = await request(app)
        .put(`/shops/${shop.id}`)
        .set("Authorization", pro2.authorization)
        .send({ name: "Pirate" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Vous n'êtes pas le propriétaire de cette boutique");
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app)
        .put("/shops/1")
        .send({ name: "Test" });

      expect(res.status).toBe(401);
    });

    it("retourne 404 si la boutique n'existe pas", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });

      const res = await request(app)
        .put("/shops/9999")
        .set("Authorization", pro.authorization)
        .send({ name: "Test" });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // DELETE /shops/:id — ownership
  // ============================================================
  describe("DELETE /shops/:id", () => {
    it("permet au propriétaire de supprimer sa boutique (204)", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id });

      const res = await request(app)
        .delete(`/shops/${shop.id}`)
        .set("Authorization", pro.authorization);

      expect(res.status).toBe(204);

      // Vérifier que la boutique n'existe plus
      const check = await request(app).get(`/shops/${shop.id}`);
      expect(check.status).toBe(404);
    });

    it("refuse si l'utilisateur n'est pas le propriétaire (403)", async () => {
      const pro1 = await createUser({ email: "pro1@test.com", role: "professionnel" });
      const pro2 = await createUser({ email: "pro2@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro1.id });

      const res = await request(app)
        .delete(`/shops/${shop.id}`)
        .set("Authorization", pro2.authorization);

      expect(res.status).toBe(403);
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app).delete("/shops/1");

      expect(res.status).toBe(401);
    });
  });
});
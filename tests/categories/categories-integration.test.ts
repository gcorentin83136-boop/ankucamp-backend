import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser, createShop } from "../helpers/factories";
import { categories } from "../../src/core/db/schema";
import { eq } from "drizzle-orm";
import { testDb } from "../helpers/testSetup";

describe("Categories integration", () => {
  // ============================================================
  // LECTURE PUBLIQUE
  // ============================================================

  describe("GET /categories", () => {
    it("retourne tableau vide au départ", async () => {
      const res = await request(app).get("/categories");
      expect(res.status).toBe(200);
      expect(res.body.categories).toEqual([]);
    });

    it("liste les catégories triées par nom", async () => {
      const admin = await createUser({
        email: "admin-cat1@test.com",
        role: "admin",
      });

      await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Fruits", slug: "fruits" });
      await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Légumes", slug: "legumes" });

      const res = await request(app).get("/categories");
      expect(res.body.categories).toHaveLength(2);
      expect(res.body.categories[0].name).toBe("Fruits");
    });
  });

  describe("GET /categories/:id", () => {
    it("retourne une catégorie par ID", async () => {
      const admin = await createUser({
        email: "admin-cat2@test.com",
        role: "admin",
      });
      const createRes = await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Bio", slug: "bio", icon: "🌱" });

      const catId = createRes.body.category.id;

      const res = await request(app).get(`/categories/${catId}`);
      expect(res.status).toBe(200);
      expect(res.body.category.slug).toBe("bio");
      expect(res.body.category.icon).toBe("🌱");
      expect(res.body.category.shops_count).toBe(0);
    });

    it("404 si inexistant", async () => {
      const res = await request(app).get("/categories/999999");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /categories/slug/:slug", () => {
    it("retourne par slug", async () => {
      const admin = await createUser({
        email: "admin-cat3@test.com",
        role: "admin",
      });
      await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Produits laitiers", slug: "produits-laitiers" });

      const res = await request(app).get(
        "/categories/slug/produits-laitiers"
      );
      expect(res.status).toBe(200);
      expect(res.body.category.name).toBe("Produits laitiers");
    });
  });

  // ============================================================
  // ADMIN — CREATE
  // ============================================================

  describe("POST /admin/categories", () => {
    it("crée une catégorie (201)", async () => {
      const admin = await createUser({
        email: "admin-cat4@test.com",
        role: "admin",
      });

      const res = await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Fromages", slug: "fromages" });

      expect(res.status).toBe(201);
      expect(res.body.category.name).toBe("Fromages");
    });

    it("refuse si non-admin (403)", async () => {
      const user = await createUser({ email: "user-cat@test.com" });

      const res = await request(app)
        .post("/admin/categories")
        .set("Authorization", user.authorization)
        .send({ name: "Hack", slug: "hack" });

      expect(res.status).toBe(403);
    });

    it("refuse slug en double (409)", async () => {
      const admin = await createUser({
        email: "admin-cat5@test.com",
        role: "admin",
      });

      await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Test", slug: "test" });

      const res = await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Test 2", slug: "test" });

      expect(res.status).toBe(409);
    });

    it("refuse slug avec majuscules (400)", async () => {
      const admin = await createUser({
        email: "admin-cat6@test.com",
        role: "admin",
      });

      const res = await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Test", slug: "TEST" });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // ADMIN — UPDATE
  // ============================================================

  describe("PUT /admin/categories/:id", () => {
    it("met à jour le nom", async () => {
      const admin = await createUser({
        email: "admin-cat7@test.com",
        role: "admin",
      });
      const createRes = await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Old", slug: "old" });

      const res = await request(app)
        .put(`/admin/categories/${createRes.body.category.id}`)
        .set("Authorization", admin.authorization)
        .send({ name: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.category.name).toBe("New Name");
    });

    it("404 si inexistant", async () => {
      const admin = await createUser({
        email: "admin-cat8@test.com",
        role: "admin",
      });

      const res = await request(app)
        .put("/admin/categories/999999")
        .set("Authorization", admin.authorization)
        .send({ name: "Nope" });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // ADMIN — DELETE
  // ============================================================

  describe("DELETE /admin/categories/:id", () => {
    it("supprime une catégorie non utilisée (204)", async () => {
      const admin = await createUser({
        email: "admin-cat9@test.com",
        role: "admin",
      });
      const createRes = await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Tmp", slug: "tmp" });

      const res = await request(app)
        .delete(`/admin/categories/${createRes.body.category.id}`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(204);
    });

    it("refuse si la catégorie est utilisée par une boutique (400)", async () => {
      const admin = await createUser({
        email: "admin-cat10@test.com",
        role: "admin",
      });
      const owner = await createUser({
        email: "owner-cat@test.com",
        role: "professionnel",
      });

      // Crée catégorie + shop
      const createRes = await request(app)
        .post("/admin/categories")
        .set("Authorization", admin.authorization)
        .send({ name: "Bio2", slug: "bio2" });
      const catId = createRes.body.category.id;

      const shop = await createShop({ owner_id: owner.id, name: "Shop Bio" });

      // Lie la catégorie à la boutique
      const { shopCategories } = await import("../../src/core/db/schema");
      await testDb.insert(shopCategories).values({
        shop_id: shop.id,
        category_id: catId,
      });

      const res = await request(app)
        .delete(`/admin/categories/${catId}`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/boutique/i);
    });
  });
});
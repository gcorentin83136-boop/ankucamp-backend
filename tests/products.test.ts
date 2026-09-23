import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import "./helpers/testSetup";
import { createUser, createShop, createProduct } from "./helpers/factories";

describe("Products module", () => {
  // ============================================================
  // GET /products — public
  // ============================================================
  describe("GET /products", () => {
    it("retourne une liste vide au départ", async () => {
      const res = await request(app).get("/products");
      expect(res.status).toBe(200);
      expect(res.body.products).toEqual([]);
    });

    it("retourne les produits existants", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id });
      await createProduct({ shop_id: shop.id, name: "Table" });
      await createProduct({ shop_id: shop.id, name: "Chaise" });

      const res = await request(app).get("/products");
      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(2);
    });
  });

  // ============================================================
  // GET /products/shop/:shopId
  // ============================================================
  describe("GET /products/shop/:shopId", () => {
    it("retourne uniquement les produits de la boutique", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop1 = await createShop({ owner_id: pro.id, name: "Shop 1" });
      const shop2 = await createShop({ owner_id: pro.id, name: "Shop 2" });

      await createProduct({ shop_id: shop1.id, name: "Produit Shop1" });
      await createProduct({ shop_id: shop2.id, name: "Produit Shop2" });
      await createProduct({ shop_id: shop2.id, name: "Produit Shop2 bis" });

      const res = await request(app).get(`/products/shop/${shop1.id}`);

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].name).toBe("Produit Shop1");
    });
  });

  // ============================================================
  // GET /products/:id — public
  // ============================================================
  describe("GET /products/:id", () => {
    it("retourne un produit existant", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id });
      const product = await createProduct({ shop_id: shop.id, name: "Table" });

      const res = await request(app).get(`/products/${product.id}`);

      expect(res.status).toBe(200);
      expect(res.body.product.name).toBe("Table");
    });

    it("retourne 404 si le produit n'existe pas", async () => {
      const res = await request(app).get("/products/9999");
      expect(res.status).toBe(404);
    });

    it("retourne 400 si l'ID est invalide", async () => {
      const res = await request(app).get("/products/abc");
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // POST /products — pro + ownership de la boutique
  // ============================================================
  describe("POST /products", () => {
    it("refuse sans token (401)", async () => {
      const res = await request(app)
        .post("/products")
        .send({ shop_id: 1, name: "Test", price: 10 });

      expect(res.status).toBe(401);
    });

    it("refuse un particulier (403)", async () => {
      const part = await createUser({ email: "part@test.com", role: "particulier" });

      const res = await request(app)
        .post("/products")
        .set("Authorization", part.authorization)
        .send({ shop_id: 1, name: "Test", price: 10 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Accès interdit");
    });

    it("crée un produit dans SA boutique (201)", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id });

      const res = await request(app)
        .post("/products")
        .set("Authorization", pro.authorization)
        .send({
          shop_id: shop.id,
          name: "Chaise en bois",
          description: "Belle chaise",
          price: 49.9,
          stock: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.product.name).toBe("Chaise en bois");
      expect(res.body.product.price).toBe("49.90");
      expect(res.body.product.stock).toBe(5);
    });

    it("refuse si on n'est PAS le propriétaire de la boutique (403)", async () => {
      const pro1 = await createUser({ email: "pro1@test.com", role: "professionnel" });
      const pro2 = await createUser({ email: "pro2@test.com", role: "professionnel" });
      const shopOfPro1 = await createShop({ owner_id: pro1.id });

      const res = await request(app)
        .post("/products")
        .set("Authorization", pro2.authorization)
        .send({ shop_id: shopOfPro1.id, name: "Pirate", price: 10 });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Vous n'êtes pas le propriétaire de cette boutique");
    });

    it("refuse si la boutique n'existe pas (404)", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });

      const res = await request(app)
        .post("/products")
        .set("Authorization", pro.authorization)
        .send({ shop_id: 9999, name: "Test", price: 10 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Boutique introuvable");
    });

    it("refuse un prix négatif (400)", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id });

      const res = await request(app)
        .post("/products")
        .set("Authorization", pro.authorization)
        .send({ shop_id: shop.id, name: "Test", price: -10 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Données invalides");
    });
  });

  // ============================================================
  // PUT /products/:id — ownership à 2 niveaux
  // ============================================================
  describe("PUT /products/:id", () => {
    it("permet au propriétaire de la boutique de modifier le produit", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id });
      const product = await createProduct({ shop_id: shop.id, name: "Vieux nom", price: 10 });

      const res = await request(app)
        .put(`/products/${product.id}`)
        .set("Authorization", pro.authorization)
        .send({ name: "Nouveau nom", price: 25 });

      expect(res.status).toBe(200);
      expect(res.body.product.name).toBe("Nouveau nom");
      expect(res.body.product.price).toBe("25.00");
    });

    it("refuse si on n'est PAS le propriétaire de la boutique parente (403)", async () => {
      const pro1 = await createUser({ email: "pro1@test.com", role: "professionnel" });
      const pro2 = await createUser({ email: "pro2@test.com", role: "professionnel" });
      const shopOfPro1 = await createShop({ owner_id: pro1.id });
      const product = await createProduct({ shop_id: shopOfPro1.id });

      const res = await request(app)
        .put(`/products/${product.id}`)
        .set("Authorization", pro2.authorization)
        .send({ name: "Pirate" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Vous n'êtes pas le propriétaire de cette boutique");
    });

    it("retourne 404 si le produit n'existe pas", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });

      const res = await request(app)
        .put("/products/9999")
        .set("Authorization", pro.authorization)
        .send({ name: "Test" });

      expect(res.status).toBe(404);
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app).put("/products/1").send({ name: "Test" });
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // DELETE /products/:id — ownership à 2 niveaux
  // ============================================================
  describe("DELETE /products/:id", () => {
    it("permet au propriétaire de la boutique de supprimer le produit (204)", async () => {
      const pro = await createUser({ email: "pro@test.com", role: "professionnel" });
      const shop = await createShop({ owner_id: pro.id });
      const product = await createProduct({ shop_id: shop.id });

      const res = await request(app)
        .delete(`/products/${product.id}`)
        .set("Authorization", pro.authorization);

      expect(res.status).toBe(204);

      const check = await request(app).get(`/products/${product.id}`);
      expect(check.status).toBe(404);
    });

    it("refuse si on n'est PAS le propriétaire de la boutique parente (403)", async () => {
      const pro1 = await createUser({ email: "pro1@test.com", role: "professionnel" });
      const pro2 = await createUser({ email: "pro2@test.com", role: "professionnel" });
      const shopOfPro1 = await createShop({ owner_id: pro1.id });
      const product = await createProduct({ shop_id: shopOfPro1.id });

      const res = await request(app)
        .delete(`/products/${product.id}`)
        .set("Authorization", pro2.authorization);

      expect(res.status).toBe(403);
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app).delete("/products/1");
      expect(res.status).toBe(401);
    });
  });
});
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser, createShop, createProduct } from "../helpers/factories";

describe("Wishlist integration", () => {
  async function setupUserAndProduct() {
    const seller = await createUser({
      email: `seller-wish-${Date.now()}@test.com`,
      role: "professionnel",
    });
    const user = await createUser({
      email: `user-wish-${Date.now()}@test.com`,
    });

    const shop = await createShop({ owner_id: seller.id, name: "Shop Wish" });
    const product = await createProduct({
      shop_id: shop.id,
      name: "Produit favori",
      price: 15,
    });

    return { seller, user, shop, product };
  }

  // ============================================================
  // AJOUT (toggle)
  // ============================================================

  describe("POST /wishlist/:productId", () => {
    it("ajoute aux favoris (in_wishlist: true)", async () => {
      const { user, product } = await setupUserAndProduct();

      const res = await request(app)
        .post(`/wishlist/${product.id}`)
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.in_wishlist).toBe(true);
    });

    it("toggle : retire au 2ᵉ appel", async () => {
      const { user, product } = await setupUserAndProduct();

      await request(app)
        .post(`/wishlist/${product.id}`)
        .set("Authorization", user.authorization);

      const res = await request(app)
        .post(`/wishlist/${product.id}`)
        .set("Authorization", user.authorization);

      expect(res.body.in_wishlist).toBe(false);
    });

    it("refuse si non authentifié (401)", async () => {
      const { product } = await setupUserAndProduct();

      const res = await request(app).post(`/wishlist/${product.id}`);
      expect(res.status).toBe(401);
    });

    it("404 si produit inexistant", async () => {
      const { user } = await setupUserAndProduct();

      const res = await request(app)
        .post("/wishlist/999999")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // LECTURE
  // ============================================================

  describe("GET /wishlist", () => {
    it("retourne tableau vide au départ", async () => {
      const { user } = await setupUserAndProduct();

      const res = await request(app)
        .get("/wishlist")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it("liste les favoris avec produit enrichi", async () => {
      const { user, product } = await setupUserAndProduct();

      await request(app)
        .post(`/wishlist/${product.id}`)
        .set("Authorization", user.authorization);

      const res = await request(app)
        .get("/wishlist")
        .set("Authorization", user.authorization);

      expect(res.body.count).toBe(1);
      expect(res.body.items[0].id).toBe(product.id);
      expect(res.body.items[0].shop).toBeDefined();
    });
  });

  describe("GET /wishlist/count", () => {
    it("retourne le nombre de favoris", async () => {
      const { user, product } = await setupUserAndProduct();

      await request(app)
        .post(`/wishlist/${product.id}`)
        .set("Authorization", user.authorization);

      const res = await request(app)
        .get("/wishlist/count")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });
  });

  describe("GET /wishlist/check/:productId", () => {
    it("retourne in_wishlist: false si pas dedans", async () => {
      const { user, product } = await setupUserAndProduct();

      const res = await request(app)
        .get(`/wishlist/check/${product.id}`)
        .set("Authorization", user.authorization);

      expect(res.body.in_wishlist).toBe(false);
    });

    it("retourne in_wishlist: true après ajout", async () => {
      const { user, product } = await setupUserAndProduct();

      await request(app)
        .post(`/wishlist/${product.id}`)
        .set("Authorization", user.authorization);

      const res = await request(app)
        .get(`/wishlist/check/${product.id}`)
        .set("Authorization", user.authorization);

      expect(res.body.in_wishlist).toBe(true);
    });
  });

  describe("GET /wishlist/product-ids", () => {
    it("retourne tableau d'IDs pour les cœurs", async () => {
      const { user, product } = await setupUserAndProduct();

      await request(app)
        .post(`/wishlist/${product.id}`)
        .set("Authorization", user.authorization);

      const res = await request(app)
        .get("/wishlist/product-ids")
        .set("Authorization", user.authorization);

      expect(res.body.product_ids).toEqual([product.id]);
    });
  });
});
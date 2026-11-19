import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser, createShop, createProduct } from "../helpers/factories";

describe("Cart integration", () => {
  async function setupSellerAndProducts() {
    const seller = await createUser({
      email: `seller-cart-${Date.now()}@test.com`,
      role: "professionnel",
    });
    const buyer = await createUser({
      email: `buyer-cart-${Date.now()}@test.com`,
    });

    const shop = await createShop({ owner_id: seller.id, name: "Ma Boutique" });
    const productA = await createProduct({
      shop_id: shop.id,
      name: "Pomme",
      price: 10,
      stock: 10,
    });
    const productB = await createProduct({
      shop_id: shop.id,
      name: "Poire",
      price: 20,
      stock: 5,
    });

    return { seller, buyer, shop, productA, productB };
  }

  // ============================================================
  // AJOUT
  // ============================================================

  describe("POST /cart/items", () => {
    it("ajoute un produit (201)", async () => {
      const { buyer, productA } = await setupSellerAndProducts();

      const res = await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 2 });

      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(2);
      expect(res.body.items_count).toBe(2);
      expect(res.body.subtotal).toBe(20);
    });

    it("cumule les quantités si produit déjà dans panier", async () => {
      const { buyer, productA } = await setupSellerAndProducts();

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 2 });

      const res = await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 3 });

      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it("refuse stock insuffisant (400)", async () => {
      const { buyer, productB } = await setupSellerAndProducts();

      const res = await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productB.id, quantity: 100 });

      expect(res.status).toBe(400);
    });

    it("refuse produit inexistant (404)", async () => {
      const { buyer } = await setupSellerAndProducts();

      const res = await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: 999999, quantity: 1 });

      expect(res.status).toBe(404);
    });

    it("refuse si non authentifié (401)", async () => {
      const res = await request(app)
        .post("/cart/items")
        .send({ product_id: 1, quantity: 1 });
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // LECTURE
  // ============================================================

  describe("GET /cart", () => {
    it("retourne panier vide au départ", async () => {
      const { buyer } = await setupSellerAndProducts();

      const res = await request(app)
        .get("/cart")
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
      expect(res.body.items_count).toBe(0);
      expect(res.body.subtotal).toBe(0);
    });

    it("regroupe les items par vendeur", async () => {
      const { buyer, productA, productB } = await setupSellerAndProducts();

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 1 });
      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productB.id, quantity: 2 });

      const res = await request(app)
        .get("/cart")
        .set("Authorization", buyer.authorization);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.by_seller).toHaveLength(1);
      expect(res.body.by_seller[0].items).toHaveLength(2);
      expect(res.body.subtotal).toBe(50);
    });
  });

  // ============================================================
  // MODIFIER
  // ============================================================

  describe("PUT /cart/items/:productId", () => {
    it("modifie la quantité (200)", async () => {
      const { buyer, productA } = await setupSellerAndProducts();

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 1 });

      const res = await request(app)
        .put(`/cart/items/${productA.id}`)
        .set("Authorization", buyer.authorization)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it("refuse si produit absent du panier (404)", async () => {
      const { buyer, productA } = await setupSellerAndProducts();

      const res = await request(app)
        .put(`/cart/items/${productA.id}`)
        .set("Authorization", buyer.authorization)
        .send({ quantity: 5 });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // RETIRER
  // ============================================================

  describe("DELETE /cart/items/:productId", () => {
    it("retire un produit du panier", async () => {
      const { buyer, productA } = await setupSellerAndProducts();

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 1 });

      const res = await request(app)
        .delete(`/cart/items/${productA.id}`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe("DELETE /cart", () => {
    it("vide tout le panier", async () => {
      const { buyer, productA, productB } = await setupSellerAndProducts();

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 1 });
      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productB.id, quantity: 1 });

      const res = await request(app)
        .delete("/cart")
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get("/cart")
        .set("Authorization", buyer.authorization);
      expect(getRes.body.items).toHaveLength(0);
    });
  });

  // ============================================================
  // CHECKOUT
  // ============================================================

  describe("POST /cart/checkout", () => {
    it("refuse si panier vide (400)", async () => {
      const { buyer } = await setupSellerAndProducts();

      const res = await request(app)
        .post("/cart/checkout")
        .set("Authorization", buyer.authorization)
        .send({ delivery_method: "pickup" });

      expect(res.status).toBe(400);
    });

    it("crée 1 commande + décrémente le stock", async () => {
      const { buyer, seller, productA } = await setupSellerAndProducts();

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 3 });

      const res = await request(app)
        .post("/cart/checkout")
        .set("Authorization", buyer.authorization)
        .send({ delivery_method: "pickup" });

      expect(res.status).toBe(201);
      expect(res.body.orders_count).toBe(1);
      expect(res.body.orders[0].seller_id).toBe(seller.id);

      // Vérifie que le stock a bien diminué (10 - 3 = 7)
      const productRes = await request(app).get(`/products/${productA.id}`);
      expect(productRes.body.product.stock).toBe(7);

      // Vérifie que le panier est vide
      const cartRes = await request(app)
        .get("/cart")
        .set("Authorization", buyer.authorization);
      expect(cartRes.body.items).toHaveLength(0);
    });

    it("crée 2 commandes si 2 vendeurs différents", async () => {
      const buyer = await createUser({ email: "buyer-multi@test.com" });
      const seller1 = await createUser({
        email: "seller1-multi@test.com",
        role: "professionnel",
      });
      const seller2 = await createUser({
        email: "seller2-multi@test.com",
        role: "professionnel",
      });

      const shop1 = await createShop({ owner_id: seller1.id, name: "Shop A" });
      const shop2 = await createShop({ owner_id: seller2.id, name: "Shop B" });

      const p1 = await createProduct({ shop_id: shop1.id, price: 10, stock: 5 });
      const p2 = await createProduct({ shop_id: shop2.id, price: 20, stock: 5 });

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: p1.id, quantity: 1 });
      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: p2.id, quantity: 1 });

      const res = await request(app)
        .post("/cart/checkout")
        .set("Authorization", buyer.authorization)
        .send({ delivery_method: "pickup" });

      expect(res.status).toBe(201);
      expect(res.body.orders_count).toBe(2);

      const sellerIds = res.body.orders.map((o: any) => o.seller_id).sort();
      expect(sellerIds).toEqual([seller1.id, seller2.id].sort());
    });

    it("refuse si delivery_method invalide (400)", async () => {
      const { buyer, productA } = await setupSellerAndProducts();

      await request(app)
        .post("/cart/items")
        .set("Authorization", buyer.authorization)
        .send({ product_id: productA.id, quantity: 1 });

      const res = await request(app)
        .post("/cart/checkout")
        .set("Authorization", buyer.authorization)
        .send({ delivery_method: "banana" });

      expect(res.status).toBe(400);
    });
  });
});
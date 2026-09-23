import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import "./helpers/testSetup";
import {
  createUser,
  createShop,
  createProduct,
  createOrder,
} from "./helpers/factories";
import { testDb } from "./helpers/testSetup";
import { products } from "../src/core/db/schema";
import { eq } from "drizzle-orm";

describe("Orders module", () => {
  // ============================================================
  // Helpers
  // ============================================================

  async function setupSellerAndBuyer() {
    const seller = await createUser({
      email: "seller@test.com",
      role: "professionnel",
    });
    const buyer = await createUser({
      email: "buyer@test.com",
      role: "particulier",
    });
    const shop = await createShop({ owner_id: seller.id, name: "Shop du seller" });
    const product1 = await createProduct({
      shop_id: shop.id,
      name: "Table",
      price: 100,
      stock: 5,
    });
    const product2 = await createProduct({
      shop_id: shop.id,
      name: "Chaise",
      price: 50,
      stock: 10,
    });
    return { seller, buyer, shop, product1, product2 };
  }

  // ============================================================
  // GET /orders/me
  // ============================================================
  describe("GET /orders/me", () => {
    it("refuse sans token (401)", async () => {
      const res = await request(app).get("/orders/me");
      expect(res.status).toBe(401);
    });

    it("retourne une liste vide si pas de commande", async () => {
      const { buyer } = await setupSellerAndBuyer();

      const res = await request(app)
        .get("/orders/me")
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.orders).toEqual([]);
    });

    it("retourne uniquement les commandes du buyer connecté", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const buyer2 = await createUser({ email: "buyer2@test.com" });

      await createOrder({ buyer_id: buyer.id, seller_id: seller.id });
      await createOrder({ buyer_id: buyer2.id, seller_id: seller.id });

      const res = await request(app)
        .get("/orders/me")
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].buyer_id).toBe(buyer.id);
    });
  });

  // ============================================================
  // GET /orders/seller/me
  // ============================================================
  describe("GET /orders/seller/me", () => {
    it("retourne les commandes reçues par le seller", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      await createOrder({ buyer_id: buyer.id, seller_id: seller.id });

      const res = await request(app)
        .get("/orders/seller/me")
        .set("Authorization", seller.authorization);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].seller_id).toBe(seller.id);
    });
  });

  // ============================================================
  // GET /orders/:id
  // ============================================================
  describe("GET /orders/:id", () => {
    it("retourne la commande au buyer", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
      });

      const res = await request(app)
        .get(`/orders/${order.id}`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.order.id).toBe(order.id);
    });

    it("retourne la commande au seller", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
      });

      const res = await request(app)
        .get(`/orders/${order.id}`)
        .set("Authorization", seller.authorization);

      expect(res.status).toBe(200);
    });

    it("refuse à un user extérieur (403)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const outsider = await createUser({ email: "out@test.com" });
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
      });

      const res = await request(app)
        .get(`/orders/${order.id}`)
        .set("Authorization", outsider.authorization);

      expect(res.status).toBe(403);
    });

    it("retourne 404 si la commande n'existe pas", async () => {
      const { buyer } = await setupSellerAndBuyer();

      const res = await request(app)
        .get("/orders/9999")
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // POST /orders — LA partie complexe
  // ============================================================
  describe("POST /orders", () => {
    it("refuse sans token (401)", async () => {
      const res = await request(app).post("/orders").send({});
      expect(res.status).toBe(401);
    });

    it("crée une commande (201) et calcule le total", async () => {
      const { seller, buyer, product1, product2 } = await setupSellerAndBuyer();

      const res = await request(app)
        .post("/orders")
        .set("Authorization", buyer.authorization)
        .send({
          seller_id: seller.id,
          delivery_method: "delivery",
          delivery_address: "1 rue de Paris",
          items: [
            { product_id: product1.id, quantity: 1 },
            { product_id: product2.id, quantity: 2 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.order.total_price).toBe("200.00"); // 1×100 + 2×50
      expect(res.body.order.status).toBe("pending");
      expect(res.body.order.items).toHaveLength(2);
    });

    it("décrémente le stock des produits", async () => {
      const { seller, buyer, product1 } = await setupSellerAndBuyer();

      await request(app)
        .post("/orders")
        .set("Authorization", buyer.authorization)
        .send({
          seller_id: seller.id,
          delivery_method: "pickup",
          items: [{ product_id: product1.id, quantity: 3 }],
        });

      const [updated] = await testDb
        .select()
        .from(products)
        .where(eq(products.id, product1.id));

      expect(updated.stock).toBe(2); // 5 - 3
    });

    it("refuse si le buyer = seller (400)", async () => {
      const { seller, product1 } = await setupSellerAndBuyer();

      const res = await request(app)
        .post("/orders")
        .set("Authorization", seller.authorization)
        .send({
          seller_id: seller.id,
          delivery_method: "pickup",
          items: [{ product_id: product1.id, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Vous ne pouvez pas commander chez vous-même");
    });

    it("refuse si stock insuffisant (400)", async () => {
      const { seller, buyer, product1 } = await setupSellerAndBuyer();

      const res = await request(app)
        .post("/orders")
        .set("Authorization", buyer.authorization)
        .send({
          seller_id: seller.id,
          delivery_method: "pickup",
          items: [{ product_id: product1.id, quantity: 999 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Stock insuffisant");
    });

    it("refuse un produit inexistant (404)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();

      const res = await request(app)
        .post("/orders")
        .set("Authorization", buyer.authorization)
        .send({
          seller_id: seller.id,
          delivery_method: "pickup",
          items: [{ product_id: 9999, quantity: 1 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Un ou plusieurs produits sont introuvables");
    });

    it("refuse un tableau d'items vide (400)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();

      const res = await request(app)
        .post("/orders")
        .set("Authorization", buyer.authorization)
        .send({
          seller_id: seller.id,
          delivery_method: "pickup",
          items: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Données invalides");
    });

    it("refuse un delivery_method invalide (400)", async () => {
      const { seller, buyer, product1 } = await setupSellerAndBuyer();

      const res = await request(app)
        .post("/orders")
        .set("Authorization", buyer.authorization)
        .send({
          seller_id: seller.id,
          delivery_method: "teleportation",
          items: [{ product_id: product1.id, quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // PUT /orders/:id/status
  // ============================================================
  describe("PUT /orders/:id/status", () => {
    it("permet au seller de confirmer la commande", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
        status: "pending",
      });

      const res = await request(app)
        .put(`/orders/${order.id}/status`)
        .set("Authorization", seller.authorization)
        .send({ status: "confirmed" });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe("confirmed");
    });

    it("refuse au buyer de changer le statut (sauf cancel) (403)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
        status: "pending",
      });

      const res = await request(app)
        .put(`/orders/${order.id}/status`)
        .set("Authorization", buyer.authorization)
        .send({ status: "shipped" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Seul le vendeur peut modifier le statut de la commande");
    });

    it("permet au buyer d'annuler une commande pending", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
        status: "pending",
      });

      const res = await request(app)
        .put(`/orders/${order.id}/status`)
        .set("Authorization", buyer.authorization)
        .send({ status: "cancelled" });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe("cancelled");
    });

    it("refuse d'annuler une commande déjà confirmée (400)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
        status: "confirmed",
      });

      const res = await request(app)
        .put(`/orders/${order.id}/status`)
        .set("Authorization", buyer.authorization)
        .send({ status: "cancelled" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Impossible d'annuler");
    });

    it("refuse un statut invalide (400)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
      });

      const res = await request(app)
        .put(`/orders/${order.id}/status`)
        .set("Authorization", seller.authorization)
        .send({ status: "flying" });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // DELETE /orders/:id
  // ============================================================
  describe("DELETE /orders/:id", () => {
    it("permet au buyer de supprimer une commande pending (204)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
        status: "pending",
      });

      const res = await request(app)
        .delete(`/orders/${order.id}`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(204);
    });

    it("refuse la suppression d'une commande confirmée (400)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
        status: "confirmed",
      });

      const res = await request(app)
        .delete(`/orders/${order.id}`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(400);
    });

    it("refuse la suppression par le seller (403)", async () => {
      const { seller, buyer } = await setupSellerAndBuyer();
      const order = await createOrder({
        buyer_id: buyer.id,
        seller_id: seller.id,
      });

      const res = await request(app)
        .delete(`/orders/${order.id}`)
        .set("Authorization", seller.authorization);

      expect(res.status).toBe(403);
    });
  });
});
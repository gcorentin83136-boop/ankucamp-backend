// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Reviews
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  userSessions,
  shops,
  products,
  orders,
  orderItems,
  reviews,
  reviewReports,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let sellerId: number;
let buyerId: number;
let otherId: number;

let tokenSeller: string;
let tokenBuyer: string;
let tokenOther: string;

let shopId: number;
let productId: number;
let productId2: number;
let orderId: number;
let orderId2: number; // order pending (pour tester refus)
let orderId3: number; // order delivered sans le product2

// ============================================================
// HELPERS
// ============================================================

async function upsertUser(opts: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role?: "particulier" | "professionnel";
}): Promise<number> {
  const hash = await bcrypt.hash(PASSWORD, 10);

  let userId: number;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, opts.email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ password_hash: hash, email_verified: 1 })
      .where(eq(users.id, existing.id));

    userId = existing.id;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        first_name: opts.first_name,
        last_name: opts.last_name,
        username: opts.username,
        email: opts.email,
        role: opts.role ?? "particulier",
        email_verified: 1,
        password_hash: hash,
      })
      .returning();

    userId = created.id;
  }

  await db
    .insert(userSettings)
    .values({ user_id: userId, search_indexable: 1 })
    .onConflictDoNothing({ target: userSettings.user_id });

  return userId;
}

async function login(email: string): Promise<string> {
  const res = await request(app)
    .post("/auth/login")
    .send({ email, password: PASSWORD });

  if (!res.body.token) {
    throw new Error(`Login échoué pour ${email} : ${JSON.stringify(res.body)}`);
  }

  return res.body.token;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ============================================================
// BEFORE ALL — Setup complet
// ============================================================

beforeAll(async () => {
  // 1. Cleanup préalable
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "revtest_seller@test.com",
        "revtest_buyer@test.com",
        "revtest_other@test.com",
      ])
    );

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);

    // Supprime les avis + reports
    const oldReviews = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(inArray(reviews.author_id, ids));
    if (oldReviews.length > 0) {
      const reviewIds = oldReviews.map((r) => r.id);
      await db
        .delete(reviewReports)
        .where(inArray(reviewReports.review_id, reviewIds));
      await db.delete(reviews).where(inArray(reviews.id, reviewIds));
    }

    // Supprime orders + orderItems
    const oldOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.buyer_id, ids));
    if (oldOrders.length > 0) {
      const orderIds = oldOrders.map((o) => o.id);
      await db
        .delete(orderItems)
        .where(inArray(orderItems.order_id, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    // Supprime produits + shops
    const oldShops = await db
      .select({ id: shops.id })
      .from(shops)
      .where(inArray(shops.owner_id, ids));
    if (oldShops.length > 0) {
      const shopIds = oldShops.map((s) => s.id);
      await db
        .delete(products)
        .where(inArray(products.shop_id, shopIds));
      await db.delete(shops).where(inArray(shops.id, shopIds));
    }

    // Supprime sessions + settings + users
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  // 2. Crée les users
  sellerId = await upsertUser({
    email: "revtest_seller@test.com",
    username: "revtest_seller",
    first_name: "Seller",
    last_name: "Test",
    role: "professionnel",
  });

  buyerId = await upsertUser({
    email: "revtest_buyer@test.com",
    username: "revtest_buyer",
    first_name: "Buyer",
    last_name: "Test",
  });

  otherId = await upsertUser({
    email: "revtest_other@test.com",
    username: "revtest_other",
    first_name: "Other",
    last_name: "Test",
  });

  tokenSeller = await login("revtest_seller@test.com");
  tokenBuyer = await login("revtest_buyer@test.com");
  tokenOther = await login("revtest_other@test.com");

  // 3. Crée shop + products
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop Reviews Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [prod1] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit Test 1",
      price: "19.99",
      stock: 10,
    })
    .returning();
  productId = prod1.id;

  const [prod2] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit Test 2",
      price: "49.99",
      stock: 5,
    })
    .returning();
  productId2 = prod2.id;

  // 4. Crée 3 orders
  // Order 1 : delivered avec productId (pour avis valide)
  const [o1] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "19.99",
      status: "delivered",
      delivery_method: "standard",
    })
    .returning();
  orderId = o1.id;

  await db.insert(orderItems).values({
    order_id: orderId,
    product_id: productId,
    quantity: 1,
    unit_price: "19.99",
  });

  // Order 2 : pending (pour tester refus statut)
  const [o2] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "19.99",
      status: "pending",
      delivery_method: "standard",
    })
    .returning();
  orderId2 = o2.id;

  await db.insert(orderItems).values({
    order_id: orderId2,
    product_id: productId,
    quantity: 1,
    unit_price: "19.99",
  });

  // Order 3 : delivered SANS product2 (pour tester refus produit)
  const [o3] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "19.99",
      status: "delivered",
      delivery_method: "standard",
    })
    .returning();
  orderId3 = o3.id;

  await db.insert(orderItems).values({
    order_id: orderId3,
    product_id: productId,
    quantity: 1,
    unit_price: "19.99",
  });
});

// ============================================================
// AFTER ALL — Nettoyage complet
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, buyerId, otherId];

    // Reviews + reports
    const allReviews = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(inArray(reviews.author_id, userIds));
    if (allReviews.length > 0) {
      const reviewIds = allReviews.map((r) => r.id);
      await db
        .delete(reviewReports)
        .where(inArray(reviewReports.review_id, reviewIds));
      await db.delete(reviews).where(inArray(reviews.id, reviewIds));
    }
    // Reviews dont le seller_id = sellerId (créés par d'autres)
    await db.delete(reviews).where(eq(reviews.seller_id, sellerId));

    // Orders + items
    const allOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.buyer_id, userIds));
    if (allOrders.length > 0) {
      const orderIds = allOrders.map((o) => o.id);
      await db
        .delete(orderItems)
        .where(inArray(orderItems.order_id, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    // Products + shops
    await db.delete(products).where(inArray(products.shop_id, [shopId]));
    await db.delete(shops).where(eq(shops.id, shopId));

    // Sessions + settings + users
    await db.delete(userSessions).where(inArray(userSessions.user_id, userIds));
    await db.delete(userSettings).where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /reviews/product/:id/stats
// ============================================================

describe("Reviews — GET /reviews/product/:id/stats", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}/stats`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toHaveProperty("average");
    expect(res.body.stats).toHaveProperty("total");
    expect(res.body.stats).toHaveProperty("distribution");
  });

  it("retourne 0 avis pour un produit neuf", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}/stats`
    );

    expect(res.body.stats.total).toBe(0);
    expect(res.body.stats.average).toBe(0);
  });

  it("distribution contient les clés 1 à 5", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}/stats`
    );

    const dist = res.body.stats.distribution;
    expect(dist).toHaveProperty("1");
    expect(dist).toHaveProperty("5");
  });

  it("rejette un productId invalide (400)", async () => {
    const res = await request(app).get("/reviews/product/abc/stats");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 2. POST /reviews — Création
// ============================================================

describe("Reviews — POST /reviews", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/reviews")
      .send({ order_id: orderId, product_id: productId, rating: 5 });

    expect(res.status).toBe(401);
  });

  it("rejette un rating > 5 (400)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId, product_id: productId, rating: 10 });

    expect(res.status).toBe(400);
  });

  it("rejette un rating < 1 (400)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId, product_id: productId, rating: 0 });

    expect(res.status).toBe(400);
  });

  it("rejette si l'order n'existe pas (404)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({ order_id: 999999, product_id: productId, rating: 5 });

    expect(res.status).toBe(404);
  });

  it("rejette si ce n'est pas l'acheteur (403)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenOther))
      .send({ order_id: orderId, product_id: productId, rating: 5 });

    expect(res.status).toBe(403);
  });

  it("rejette si la commande n'est pas delivered (400)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId2, product_id: productId, rating: 5 });

    expect(res.status).toBe(400);
  });

  it("rejette si le produit n'est pas dans la commande (400)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId3, product_id: productId2, rating: 5 });

    expect(res.status).toBe(400);
  });

  it("crée un avis valide (201)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({
        order_id: orderId,
        product_id: productId,
        rating: 5,
        comment: "Super produit !",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.review).toHaveProperty("id");
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.seller_id).toBe(sellerId);
  });

  it("rejette un 2ème avis sur le même produit/order (400)", async () => {
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId, product_id: productId, rating: 4 });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 3. GET /reviews/product/:id
// ============================================================

describe("Reviews — GET /reviews/product/:id", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(`/reviews/product/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("contient les infos de l'auteur", async () => {
    const res = await request(app).get(`/reviews/product/${productId}`);

    const r = res.body.reviews[0];
    expect(r).toHaveProperty("author_first_name");
    expect(r).toHaveProperty("author_last_name");
    expect(r).toHaveProperty("rating");
    expect(r).toHaveProperty("comment");
  });

  it("accepte sort=rating_desc", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}?sort=rating_desc`
    );

    expect(res.status).toBe(200);
  });

  it("accepte sort=rating_asc", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}?sort=rating_asc`
    );

    expect(res.status).toBe(200);
  });

  it("rejette limit > 50 (400)", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}?limit=100`
    );

    expect(res.status).toBe(400);
  });

  it("rejette un productId invalide (400)", async () => {
    const res = await request(app).get("/reviews/product/abc");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. GET /reviews/me — Mes avis (auteur)
// ============================================================

describe("Reviews — GET /reviews/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/reviews/me");
    expect(res.status).toBe(401);
  });

  it("retourne mes avis", async () => {
    const res = await request(app)
      .get("/reviews/me")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it("retourne 0 avis pour un user sans avis", async () => {
    const res = await request(app)
      .get("/reviews/me")
      .set(authHeader(tokenOther));

    expect(res.body.reviews.length).toBe(0);
  });

  it("contient le product_name dans mes avis", async () => {
    const res = await request(app)
      .get("/reviews/me")
      .set(authHeader(tokenBuyer));

    expect(res.body.reviews[0]).toHaveProperty("product_name");
  });
});

// ============================================================
// 5. GET /reviews/seller/me — Avis reçus
// ============================================================

describe("Reviews — GET /reviews/seller/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/reviews/seller/me");
    expect(res.status).toBe(401);
  });

  it("retourne les avis reçus", async () => {
    const res = await request(app)
      .get("/reviews/seller/me")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it("retourne 0 avis pour un user qui n'est pas vendeur", async () => {
    const res = await request(app)
      .get("/reviews/seller/me")
      .set(authHeader(tokenOther));

    expect(res.body.reviews.length).toBe(0);
  });

  it("accepte sort=rating_desc", async () => {
    const res = await request(app)
      .get("/reviews/seller/me?sort=rating_desc")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
  });
});

// ============================================================
// 6. POST /reviews/:id/report — Signaler (vendeur)
// ============================================================

describe("Reviews — POST /reviews/:id/report", () => {
  let reviewId: number;

  beforeAll(async () => {
    // Récupère l'avis existant
    const [r] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.product_id, productId))
      .limit(1);

    reviewId = r.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post(`/reviews/${reviewId}/report`)
      .send({ reason: "Contenu inapproprié" });

    expect(res.status).toBe(401);
  });

  it("rejette si pas le vendeur concerné (403)", async () => {
    const res = await request(app)
      .post(`/reviews/${reviewId}/report`)
      .set(authHeader(tokenOther))
      .send({ reason: "Contenu inapproprié" });

    expect(res.status).toBe(403);
  });

  it("rejette une reason trop courte (400)", async () => {
    const res = await request(app)
      .post(`/reviews/${reviewId}/report`)
      .set(authHeader(tokenSeller))
      .send({ reason: "abc" });

    expect(res.status).toBe(400);
  });

  it("signale l'avis (200)", async () => {
    const res = await request(app)
      .post(`/reviews/${reviewId}/report`)
      .set(authHeader(tokenSeller))
      .send({ reason: "Contenu inapproprié et faux" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("l'avis est marqué comme signalé en DB (is_flagged = 1)", async () => {
    const [r] = await db
      .select({ is_flagged: reviews.is_flagged })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    expect(r.is_flagged).toBe(1);
  });

  it("l'avis signalé n'apparaît plus dans GET /product/:id", async () => {
    const res = await request(app).get(`/reviews/product/${productId}`);

    const found = res.body.reviews.find((r: any) => r.id === reviewId);
    expect(found).toBeUndefined();
  });

  it("rejette si on signale 2 fois (400)", async () => {
    const res = await request(app)
      .post(`/reviews/${reviewId}/report`)
      .set(authHeader(tokenSeller))
      .send({ reason: "Encore un signalement" });

    expect(res.status).toBe(400);
  });

  it("retourne 404 pour un avis inexistant", async () => {
    const res = await request(app)
      .post("/reviews/999999/report")
      .set(authHeader(tokenSeller))
      .send({ reason: "Test test" });

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 7. DELETE /reviews/:id
// ============================================================

describe("Reviews — DELETE /reviews/:id", () => {
  let newReviewId: number;

  beforeAll(async () => {
    // Crée un 2ème order delivered avec product2 pour un nouvel avis
    const [o] = await db
      .insert(orders)
      .values({
        buyer_id: buyerId,
        seller_id: sellerId,
        total_price: "49.99",
        status: "delivered",
        delivery_method: "standard",
      })
      .returning();

    await db.insert(orderItems).values({
      order_id: o.id,
      product_id: productId2,
      quantity: 1,
      unit_price: "49.99",
    });

    // Crée l'avis
    const res = await request(app)
      .post("/reviews")
      .set(authHeader(tokenBuyer))
      .send({
        order_id: o.id,
        product_id: productId2,
        rating: 4,
        comment: "Bien",
      });

    newReviewId = res.body.review.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app).delete(`/reviews/${newReviewId}`);
    expect(res.status).toBe(401);
  });

  it("rejette si pas l'auteur (403)", async () => {
    const res = await request(app)
      .delete(`/reviews/${newReviewId}`)
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(403);
  });

  it("l'auteur supprime son avis (204)", async () => {
    const res = await request(app)
      .delete(`/reviews/${newReviewId}`)
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(204);
  });

  it("l'avis est bien supprimé de la DB", async () => {
    const [r] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.id, newReviewId))
      .limit(1);

    expect(r).toBeUndefined();
  });

  it("retourne 404 pour un avis inexistant", async () => {
    const res = await request(app)
      .delete("/reviews/999999")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(404);
  });

  it("rejette un ID invalide (400)", async () => {
    const res = await request(app)
      .delete("/reviews/abc")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 8. Stats après avis
// ============================================================

describe("Reviews — Stats après création", () => {
  it("les stats reflètent l'avis (1 avis de 5 étoiles)", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}/stats`
    );

    // Le produit a 1 avis (le signalé a été créé en premier, puis marqué flagged)
    // → il n'apparaît pas dans les stats
    expect(res.body.stats.total).toBe(0);
  });

  it("distribution reflète les bons compteurs", async () => {
    const res = await request(app).get(
      `/reviews/product/${productId}/stats`
    );

    expect(res.body.stats.distribution["5"]).toBe(0);
  });
});
// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Dashboard > Seller
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
  payments,
  reviews,
  refundRequests,
  notifications,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// MOCK EMAILS
// ============================================================

vi.mock("../src/core/api/orders/orders.emails", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  resendInvoiceEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
  sendReviewRequestEmail: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let sellerId: number;
let buyerId: number;
let otherId: number;

let tokenSeller: string;
let tokenBuyer: string;

let shopId: number;
let productId1: number;
let productId2: number;
let productId3: number;

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
      .set({
        password_hash: hash,
        email_verified: 1,
        role: opts.role ?? "particulier",
      })
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
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "dashseller_seller@test.com",
        "dashseller_buyer@test.com",
        "dashseller_other@test.com",
      ])
    );

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);

    await db.delete(reviews).where(inArray(reviews.seller_id, ids));
    await db
      .delete(refundRequests)
      .where(inArray(refundRequests.requested_by, ids));

    const oldOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.seller_id, ids));
    if (oldOrders.length > 0) {
      const orderIds = oldOrders.map((o) => o.id);
      await db.delete(payments).where(inArray(payments.order_id, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.order_id, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    const oldShops = await db
      .select({ id: shops.id })
      .from(shops)
      .where(inArray(shops.owner_id, ids));
    if (oldShops.length > 0) {
      const shopIds = oldShops.map((s) => s.id);
      await db.delete(products).where(inArray(products.shop_id, shopIds));
      await db.delete(shops).where(inArray(shops.id, shopIds));
    }

    await db.delete(notifications).where(inArray(notifications.user_id, ids));
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  sellerId = await upsertUser({
    email: "dashseller_seller@test.com",
    username: "dashseller_seller",
    first_name: "Seller",
    last_name: "DashSeller",
    role: "professionnel",
  });

  buyerId = await upsertUser({
    email: "dashseller_buyer@test.com",
    username: "dashseller_buyer",
    first_name: "Buyer",
    last_name: "DashSeller",
  });

  otherId = await upsertUser({
    email: "dashseller_other@test.com",
    username: "dashseller_other",
    first_name: "Other",
    last_name: "DashSeller",
  });

  tokenSeller = await login("dashseller_seller@test.com");
  tokenBuyer = await login("dashseller_buyer@test.com");

  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop Dashboard Seller Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [p1] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit 1 (top)",
      price: "50.00",
      stock: 100,
    })
    .returning();
  productId1 = p1.id;

  const [p2] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit 2 (mid)",
      price: "30.00",
      stock: 100,
    })
    .returning();
  productId2 = p2.id;

  const [p3] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit 3 (low)",
      price: "20.00",
      stock: 100,
    })
    .returning();
  productId3 = p3.id;

  // Order 1 : pending
  const [o1] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "50.00",
      status: "pending",
      delivery_method: "shipping",
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: o1.id,
    product_id: productId1,
    quantity: 2,
    unit_price: "50.00",
  });

  // Order 2 : confirmed
  const [o2] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "30.00",
      status: "confirmed",
      delivery_method: "shipping",
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: o2.id,
    product_id: productId2,
    quantity: 3,
    unit_price: "30.00",
  });

  // Order 3 : shipped
  const [o3] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "20.00",
      status: "shipped",
      delivery_method: "shipping",
      tracking_number: "TRACK123",
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: o3.id,
    product_id: productId3,
    quantity: 1,
    unit_price: "20.00",
  });

  // Order 4 : delivered + payment succeeded
  const [o4] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "100.00",
      status: "delivered",
      delivery_method: "shipping",
      delivered_at: new Date(),
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: o4.id,
    product_id: productId1,
    quantity: 2,
    unit_price: "50.00",
  });

  await db.insert(payments).values({
    order_id: o4.id,
    user_id: buyerId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_delivered",
    stripe_session_id: "cs_test_delivered",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "100.00",
    tva_rate: "0",
    application_fee_amount: "2.50",
    seller_amount: "97.50",
    status: "succeeded",
    invoice_url: "https://cloudinary.com/fake/invoice-delivered.pdf",
  });

  // Order 5 : cancelled
  const [o5] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "50.00",
      status: "cancelled",
      delivery_method: "shipping",
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: o5.id,
    product_id: productId1,
    quantity: 1,
    unit_price: "50.00",
  });

  // Order 6 : refunded
  const [o6] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "30.00",
      status: "refunded",
      delivery_method: "shipping",
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: o6.id,
    product_id: productId2,
    quantity: 1,
    unit_price: "30.00",
  });

  // Payment ancien (pour le graphique)
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  await db.insert(payments).values({
    order_id: o4.id,
    user_id: buyerId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_old_1",
    stripe_session_id: "cs_test_old_1",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "40.00",
    tva_rate: "0",
    application_fee_amount: "1.00",
    seller_amount: "39.00",
    status: "succeeded",
    created_at: twoMonthsAgo,
  });

  // Reviews
  await db.insert(reviews).values([
    {
      order_id: o4.id,
      product_id: productId1,
      author_id: buyerId,
      seller_id: sellerId,
      rating: 5,
      comment: "Excellent !",
    },
    {
      order_id: o4.id,
      product_id: productId1,
      author_id: buyerId,
      seller_id: sellerId,
      rating: 4,
      comment: "Très bien",
    },
    {
      order_id: o4.id,
      product_id: productId2,
      author_id: buyerId,
      seller_id: sellerId,
      rating: 3,
      comment: "Correct",
    },
    {
      order_id: o4.id,
      product_id: productId2,
      author_id: buyerId,
      seller_id: sellerId,
      rating: 1,
      comment: "Mauvais (signalé)",
      is_flagged: 1,
    },
  ]);
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, buyerId, otherId];

    await db.delete(reviews).where(inArray(reviews.seller_id, userIds));
    await db
      .delete(refundRequests)
      .where(inArray(refundRequests.requested_by, userIds));

    const allOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.seller_id, userIds));

    if (allOrders.length > 0) {
      const orderIds = allOrders.map((o) => o.id);
      await db.delete(payments).where(inArray(payments.order_id, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.order_id, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    await db.delete(products).where(inArray(products.shop_id, [shopId]));
    await db.delete(shops).where(eq(shops.id, shopId));

    await db.delete(notifications).where(inArray(notifications.user_id, userIds));
    await db.delete(userSessions).where(inArray(userSessions.user_id, userIds));
    await db.delete(userSettings).where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /dashboard/seller/stats
// ============================================================

describe("Dashboard Seller — GET /dashboard/seller/stats", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/seller/stats");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les stats", async () => {
    const res = await request(app)
      .get("/dashboard/seller/stats")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("revenue");
    expect(res.body).toHaveProperty("products_count");
    expect(res.body).toHaveProperty("rating");
  });

  it("retourne 3 produits", async () => {
    const res = await request(app)
      .get("/dashboard/seller/stats")
      .set(authHeader(tokenSeller));

    expect(res.body.products_count).toBe(3);
  });

  it("a une note moyenne (exclut les avis signalés)", async () => {
    const res = await request(app)
      .get("/dashboard/seller/stats")
      .set(authHeader(tokenSeller));

    expect(res.body.rating.average).toBe(4);
    expect(res.body.rating.count).toBe(3);
  });

  it("retourne un CA total > 0", async () => {
    const res = await request(app)
      .get("/dashboard/seller/stats")
      .set(authHeader(tokenSeller));

    expect(res.body.revenue.total).toBe("136.50");
  });
});

// ============================================================
// 2. GET /dashboard/seller/orders-breakdown
// ============================================================

describe("Dashboard Seller — GET /dashboard/seller/orders-breakdown", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(
      "/dashboard/seller/orders-breakdown"
    );
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec le breakdown", async () => {
    const res = await request(app)
      .get("/dashboard/seller/orders-breakdown")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.breakdown).toBeDefined();
  });

  it("compte correctement les commandes par statut", async () => {
    const res = await request(app)
      .get("/dashboard/seller/orders-breakdown")
      .set(authHeader(tokenSeller));

    const b = res.body.breakdown;

    expect(b.pending).toBe(1);
    expect(b.confirmed).toBe(1);
    expect(b.shipped).toBe(1);
    expect(b.delivered).toBe(1);
    expect(b.cancelled).toBe(1);
    expect(b.refunded).toBe(1);
  });

  // ✅ FIX : on utilise cancelled_or_refunded (l'alias métier)
  it("retourne les alias métier", async () => {
    const res = await request(app)
      .get("/dashboard/seller/orders-breakdown")
      .set(authHeader(tokenSeller));

    const b = res.body.breakdown;

    expect(b.to_treat).toBe(1);
    expect(b.to_ship).toBe(1);
    expect(b.in_progress).toBe(1);
    expect(b.completed).toBe(1);
    expect(b.cancelled_or_refunded).toBe(2); // cancelled + refunded
  });
});

// ============================================================
// 3. GET /dashboard/seller/revenue-chart
// ============================================================

describe("Dashboard Seller — GET /dashboard/seller/revenue-chart", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/seller/revenue-chart");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec le graphique", async () => {
    const res = await request(app)
      .get("/dashboard/seller/revenue-chart")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.months).toBe(12);
    expect(Array.isArray(res.body.chart)).toBe(true);
  });

  it("contient au moins 2 mois de données (old + current)", async () => {
    const res = await request(app)
      .get("/dashboard/seller/revenue-chart")
      .set(authHeader(tokenSeller));

    expect(res.body.chart.length).toBeGreaterThanOrEqual(2);
  });

  it("accepte un paramètre months personnalisé", async () => {
    const res = await request(app)
      .get("/dashboard/seller/revenue-chart?months=6")
      .set(authHeader(tokenSeller));

    expect(res.body.months).toBe(6);
  });

  it("rejette months invalide (400)", async () => {
    const res = await request(app)
      .get("/dashboard/seller/revenue-chart?months=100")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. GET /dashboard/seller/top-products
// ============================================================

describe("Dashboard Seller — GET /dashboard/seller/top-products", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/seller/top-products");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les produits", async () => {
    const res = await request(app)
      .get("/dashboard/seller/top-products")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it("retourne le produit 1 en premier (le plus vendu)", async () => {
    const res = await request(app)
      .get("/dashboard/seller/top-products")
      .set(authHeader(tokenSeller));

    const products = res.body.products;
    expect(products[0].product_name).toBe("Produit 1 (top)");
    expect(products[0].total_sold).toBe(4);
  });

  it("exclut les commandes cancelled/refunded", async () => {
    const res = await request(app)
      .get("/dashboard/seller/top-products")
      .set(authHeader(tokenSeller));

    const p1 = res.body.products.find(
      (p: any) => p.product_name === "Produit 1 (top)"
    );
    expect(p1.total_sold).toBe(4);
  });

  it("contient les champs attendus", async () => {
    const res = await request(app)
      .get("/dashboard/seller/top-products")
      .set(authHeader(tokenSeller));

    const p = res.body.products[0];
    expect(p).toHaveProperty("product_id");
    expect(p).toHaveProperty("product_name");
    expect(p).toHaveProperty("total_sold");
    expect(p).toHaveProperty("total_revenue");
  });
});

// ============================================================
// 5. GET /dashboard/seller/ratings
// ============================================================

describe("Dashboard Seller — GET /dashboard/seller/ratings", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/seller/ratings");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les ratings", async () => {
    const res = await request(app)
      .get("/dashboard/seller/ratings")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.global).toBeDefined();
    expect(res.body.by_product).toBeDefined();
  });

  it("note globale exclut les avis flaggés", async () => {
    const res = await request(app)
      .get("/dashboard/seller/ratings")
      .set(authHeader(tokenSeller));

    expect(res.body.global.average).toBe(4);
    expect(res.body.global.count).toBe(3);
  });

  it("notes par produit correctes", async () => {
    const res = await request(app)
      .get("/dashboard/seller/ratings")
      .set(authHeader(tokenSeller));

    const byProduct = res.body.by_product;

    const p1 = byProduct.find((p: any) => p.product_id === productId1);
    expect(Number(p1.avg_rating)).toBe(4.5);
    expect(p1.reviews_count).toBe(2);

    const p2 = byProduct.find((p: any) => p.product_id === productId2);
    expect(Number(p2.avg_rating)).toBe(3);
    expect(p2.reviews_count).toBe(1);
  });
});

// ============================================================
// 6. GET /dashboard/seller/recent-reviews
// ============================================================

describe("Dashboard Seller — GET /dashboard/seller/recent-reviews", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/seller/recent-reviews");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les avis", async () => {
    const res = await request(app)
      .get("/dashboard/seller/recent-reviews")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBe(4);
  });

  it("inclut aussi les avis signalés", async () => {
    const res = await request(app)
      .get("/dashboard/seller/recent-reviews")
      .set(authHeader(tokenSeller));

    const flagged = res.body.reviews.find(
      (r: any) => r.is_flagged === 1
    );
    expect(flagged).toBeDefined();
  });

  it("retourne 0 pour un user sans avis", async () => {
    const res = await request(app)
      .get("/dashboard/seller/recent-reviews")
      .set(authHeader(tokenBuyer));

    expect(res.body.reviews.length).toBe(0);
  });
});

// ============================================================
// 7. GET /dashboard/seller/recent-orders
// ============================================================

describe("Dashboard Seller — GET /dashboard/seller/recent-orders", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/seller/recent-orders");
    expect(res.status).toBe(401);
  });

  it("retourne uniquement les commandes à traiter", async () => {
    const res = await request(app)
      .get("/dashboard/seller/recent-orders")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
    // pending + confirmed + shipped = 3
    expect(res.body.orders.length).toBe(3);
  });

  it("exclut delivered/cancelled/refunded", async () => {
    const res = await request(app)
      .get("/dashboard/seller/recent-orders")
      .set(authHeader(tokenSeller));

    for (const o of res.body.orders) {
      expect(["pending", "confirmed", "shipped"]).toContain(o.status);
    }
  });

  it("retourne 0 pour un user sans commande", async () => {
    const res = await request(app)
      .get("/dashboard/seller/recent-orders")
      .set(authHeader(tokenBuyer));

    expect(res.body.orders.length).toBe(0);
  });
});
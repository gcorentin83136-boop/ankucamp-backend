// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Dashboard > Admin
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

let adminId: number;
let sellerId: number;
let buyerId: number;

let tokenAdmin: string;
let tokenSeller: string;
let tokenBuyer: string;

let shopId: number;
let productId: number;

// ============================================================
// HELPERS
// ============================================================

async function upsertUser(opts: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role?: "particulier" | "professionnel" | "admin";
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
        "dashadmin_admin@test.com",
        "dashadmin_seller@test.com",
        "dashadmin_buyer@test.com",
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

  // Crée les users
  adminId = await upsertUser({
    email: "dashadmin_admin@test.com",
    username: "dashadmin_admin",
    first_name: "Admin",
    last_name: "DashAdmin",
    role: "admin",
  });

  sellerId = await upsertUser({
    email: "dashadmin_seller@test.com",
    username: "dashadmin_seller",
    first_name: "Seller",
    last_name: "DashAdmin",
    role: "professionnel",
  });

  buyerId = await upsertUser({
    email: "dashadmin_buyer@test.com",
    username: "dashadmin_buyer",
    first_name: "Buyer",
    last_name: "DashAdmin",
  });

  tokenAdmin = await login("dashadmin_admin@test.com");
  tokenSeller = await login("dashadmin_seller@test.com");
  tokenBuyer = await login("dashadmin_buyer@test.com");

  // Crée shop + product
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop Dashboard Admin Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [prod] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit Admin Test",
      price: "50.00",
      stock: 20,
    })
    .returning();
  productId = prod.id;

  // Crée 3 orders
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
    product_id: productId,
    quantity: 1,
    unit_price: "50.00",
  });

  const [o2] = await db
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
    order_id: o2.id,
    product_id: productId,
    quantity: 2,
    unit_price: "50.00",
  });

  await db.insert(payments).values({
    order_id: o2.id,
    user_id: buyerId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_admin_delivered",
    stripe_session_id: "cs_test_admin_delivered",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "100.00",
    tva_rate: "0",
    application_fee_amount: "2.50",
    seller_amount: "97.50",
    status: "succeeded",
    invoice_url: "https://cloudinary.com/fake/invoice-delivered.pdf",
  });

  const [o3] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "75.00",
      status: "refunded",
      delivery_method: "shipping",
    })
    .returning();

  await db.insert(orderItems).values({
    order_id: o3.id,
    product_id: productId,
    quantity: 1,
    unit_price: "75.00",
  });

  // Crée 2 reviews dont 1 flaggée
  await db.insert(reviews).values([
    {
      order_id: o2.id,
      product_id: productId,
      author_id: buyerId,
      seller_id: sellerId,
      rating: 5,
      comment: "Super !",
    },
    {
      order_id: o2.id,
      product_id: productId,
      author_id: buyerId,
      seller_id: sellerId,
      rating: 1,
      comment: "Mauvais (signalé)",
      is_flagged: 1,
      flag_reason: "Contenu inapproprié",
    },
  ]);

  // Crée 1 refund_request pending
  await db.insert(refundRequests).values({
    order_id: o3.id,
    payment_id: 0,
    requested_by: buyerId,
    reason: "Test refund admin",
    status: "pending",
    refund_amount: "75.00",
  });
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [adminId, sellerId, buyerId];

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
// 1. GET /dashboard/admin/stats
// ============================================================

describe("Dashboard Admin — GET /dashboard/admin/stats", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/admin/stats");
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/stats")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les stats (admin)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/stats")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("users");
    expect(res.body).toHaveProperty("shops");
    expect(res.body).toHaveProperty("products");
    expect(res.body).toHaveProperty("orders");
    expect(res.body).toHaveProperty("revenue");
    expect(res.body).toHaveProperty("pending_refunds");
    expect(res.body).toHaveProperty("flagged_reviews");
  });

  it("compte au moins 3 users", async () => {
    const res = await request(app)
      .get("/dashboard/admin/stats")
      .set(authHeader(tokenAdmin));

    expect(res.body.users.total).toBeGreaterThanOrEqual(3);
  });

  it("retourne les compteurs de la plateforme", async () => {
    const res = await request(app)
      .get("/dashboard/admin/stats")
      .set(authHeader(tokenAdmin));

    expect(res.body.shops).toBeGreaterThanOrEqual(1);
    expect(res.body.products).toBeGreaterThanOrEqual(1);
    expect(res.body.orders.total).toBeGreaterThanOrEqual(3);
    expect(res.body.pending_refunds).toBeGreaterThanOrEqual(1);
    expect(res.body.flagged_reviews).toBeGreaterThanOrEqual(1);
  });

  it("orders breakdown correct", async () => {
    const res = await request(app)
      .get("/dashboard/admin/stats")
      .set(authHeader(tokenAdmin));

    expect(res.body.orders.pending).toBeGreaterThanOrEqual(1);
    expect(res.body.orders.delivered).toBeGreaterThanOrEqual(1);
    expect(res.body.orders.refunded).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 2. GET /dashboard/admin/recent-users
// ============================================================

describe("Dashboard Admin — GET /dashboard/admin/recent-users", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/admin/recent-users");
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-users")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les users (admin)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-users")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);
  });

  it("retourne les 50 derniers users max", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-users")
      .set(authHeader(tokenAdmin));

    expect(res.body.users.length).toBeLessThanOrEqual(50);
  });

  it("contient les champs attendus", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-users")
      .set(authHeader(tokenAdmin));

    const u = res.body.users[0];
    expect(u).toHaveProperty("id");
    expect(u).toHaveProperty("email");
    expect(u).toHaveProperty("username");
    expect(u).toHaveProperty("role");
    expect(u).toHaveProperty("created_at");
  });
});

// ============================================================
// 3. GET /dashboard/admin/recent-orders
// ============================================================

describe("Dashboard Admin — GET /dashboard/admin/recent-orders", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/admin/recent-orders");
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-orders")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les orders (admin)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-orders")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(3);
  });

  it("retourne 50 orders max", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-orders")
      .set(authHeader(tokenAdmin));

    expect(res.body.orders.length).toBeLessThanOrEqual(50);
  });

  it("contient les champs attendus", async () => {
    const res = await request(app)
      .get("/dashboard/admin/recent-orders")
      .set(authHeader(tokenAdmin));

    const o = res.body.orders[0];
    expect(o).toHaveProperty("id");
    expect(o).toHaveProperty("buyer_id");
    expect(o).toHaveProperty("seller_id");
    expect(o).toHaveProperty("status");
  });
});

// ============================================================
// 4. GET /dashboard/admin/revenue-chart
// ============================================================

describe("Dashboard Admin — GET /dashboard/admin/revenue-chart", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/admin/revenue-chart");
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/revenue-chart")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec le graphique", async () => {
    const res = await request(app)
      .get("/dashboard/admin/revenue-chart")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.months).toBe(12);
    expect(Array.isArray(res.body.chart)).toBe(true);
  });

  it("contient les données par mois", async () => {
    const res = await request(app)
      .get("/dashboard/admin/revenue-chart")
      .set(authHeader(tokenAdmin));

    expect(res.body.chart.length).toBeGreaterThanOrEqual(1);

    const first = res.body.chart[0];
    expect(first).toHaveProperty("month");
    expect(first).toHaveProperty("gmv");
    expect(first).toHaveProperty("fees");
    expect(first).toHaveProperty("count");
  });

  it("accepte months personnalisé", async () => {
    const res = await request(app)
      .get("/dashboard/admin/revenue-chart?months=6")
      .set(authHeader(tokenAdmin));

    expect(res.body.months).toBe(6);
  });

  it("rejette months invalide (400)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/revenue-chart?months=100")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 5. GET /dashboard/admin/moderation
// ============================================================

describe("Dashboard Admin — GET /dashboard/admin/moderation", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/admin/moderation");
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/moderation")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les reviews signalées", async () => {
    const res = await request(app)
      .get("/dashboard/admin/moderation")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it("ne retourne que les reviews signalées (is_flagged = 1)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/moderation")
      .set(authHeader(tokenAdmin));

    for (const r of res.body.reviews) {
      expect(r.is_flagged).toBe(1);
    }
  });
});

// ============================================================
// 6. GET /dashboard/admin/pending-refunds
// ============================================================

describe("Dashboard Admin — GET /dashboard/admin/pending-refunds", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/admin/pending-refunds");
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .get("/dashboard/admin/pending-refunds")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("retourne 200 avec les refunds pending", async () => {
    const res = await request(app)
      .get("/dashboard/admin/pending-refunds")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.refunds)).toBe(true);
    expect(res.body.refunds.length).toBeGreaterThanOrEqual(1);
  });

  it("ne retourne que les refunds pending", async () => {
    const res = await request(app)
      .get("/dashboard/admin/pending-refunds")
      .set(authHeader(tokenAdmin));

    for (const r of res.body.refunds) {
      expect(r.status).toBe("pending");
    }
  });
});
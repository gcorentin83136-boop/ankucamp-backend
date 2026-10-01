// ============================================================
// ANKUCAMP — Tests d'intégration Rate Limiting
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
  refundRequests,
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
// MOCK CLOUDINARY (pour les tests d'upload)
// ============================================================

vi.mock("../src/config/cloudinary", () => ({
  cloudinary: {
    uploader: {
      upload_stream: vi.fn((options: any, callback: any) => {
        const stream = {
          end: () => {
            setImmediate(() => {
              callback(null, {
                secure_url: `https://res.cloudinary.com/fake/image/upload/${options.folder}/fake_${Date.now()}.jpg`,
              });
            });
          },
        };
        return stream;
      }),
    },
  },
}));

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let buyerId: number;
let sellerId: number;
let tokenBuyer: string;
let tokenSeller: string;

let shopId: number;
let productId: number;
let orderId: number;

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
    throw new Error(`Login échoué pour ${email}`);
  }

  return res.body.token;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fait N requêtes en utilisant le rate limiting avec un client unique.
 */
async function hitN(
  n: number,
  path: string,
  opts: {
    method?: "get" | "post";
    client: string;
    token?: string;
    body?: any;
    ratelimit?: boolean;
  }
) {
  const {
    method = "get",
    client,
    token,
    body,
    ratelimit = true,
  } = opts;

  const results = [];

  for (let i = 0; i < n; i++) {
    const req = method === "get" ? request(app).get(path) : request(app).post(path);

    req.set("x-test-client", client);
    if (ratelimit) req.set("x-test-ratelimit", "active");
    if (token) req.set(authHeader(token));
    if (body) req.send(body);

    const res = await req;
    results.push(res);
  }

  return results;
}

// ============================================================
// BEFORE ALL — Setup
// ============================================================

beforeAll(async () => {
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "ratelimit_seller@test.com",
        "ratelimit_buyer@test.com",
      ])
    );

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);

    await db
      .delete(refundRequests)
      .where(inArray(refundRequests.requested_by, ids));

    const oldOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.buyer_id, ids));
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

    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  sellerId = await upsertUser({
    email: "ratelimit_seller@test.com",
    username: "ratelimit_seller",
    first_name: "Seller",
    last_name: "RateLimit",
    role: "professionnel",
  });

  buyerId = await upsertUser({
    email: "ratelimit_buyer@test.com",
    username: "ratelimit_buyer",
    first_name: "Buyer",
    last_name: "RateLimit",
  });

  tokenSeller = await login("ratelimit_seller@test.com");
  tokenBuyer = await login("ratelimit_buyer@test.com");

  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop RateLimit Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [prod] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit RateLimit Test",
      price: "50.00",
      stock: 10,
    })
    .returning();
  productId = prod.id;

  const [order] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "50.00",
      status: "pending",
      delivery_method: "shipping",
    })
    .returning();
  orderId = order.id;

  await db.insert(orderItems).values({
    order_id: orderId,
    product_id: productId,
    quantity: 1,
    unit_price: "50.00",
  });
});

// ============================================================
// AFTER ALL
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, buyerId];

    await db
      .delete(refundRequests)
      .where(inArray(refundRequests.requested_by, userIds));

    const allOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.buyer_id, userIds));

    if (allOrders.length > 0) {
      const orderIds = allOrders.map((o) => o.id);
      await db.delete(payments).where(inArray(payments.order_id, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.order_id, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    await db.delete(products).where(inArray(products.shop_id, [shopId]));
    await db.delete(shops).where(eq(shops.id, shopId));

    await db.delete(userSessions).where(inArray(userSessions.user_id, userIds));
    await db.delete(userSettings).where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. SEARCH LIMITER (3 req/min en test)
// ============================================================

describe("Rate Limiting — Search (3/min)", () => {
  it("PAS de rate limit si le header x-test-ratelimit est absent", async () => {
    const results = await hitN(10, "/search/users", {
      client: "skip-test",
      ratelimit: false,
    });

    for (const r of results) {
      expect(r.status).not.toBe(429);
    }
  });

  it("1ère requête OK", async () => {
    const [r] = await hitN(1, "/search/users", { client: "search-c1" });
    expect(r.status).toBe(200);
  });

  it("jusqu'à 3 requêtes OK", async () => {
    const results = await hitN(3, "/search/users", { client: "search-c2" });

    for (const r of results) {
      expect(r.status).toBe(200);
    }
  });

  it("4ème requête → 429 Too Many Requests", async () => {
    const results = await hitN(4, "/search/users", { client: "search-c3" });

    expect(results[0].status).toBe(200);
    expect(results[1].status).toBe(200);
    expect(results[2].status).toBe(200);
    expect(results[3].status).toBe(429);
    expect(results[3].body.success).toBe(false);
  });

  it("un client différent n'est PAS impacté", async () => {
    await hitN(3, "/search/users", { client: "search-c4A" });
    const rA = await hitN(1, "/search/users", { client: "search-c4A" });
    expect(rA[0].status).toBe(429);

    const rB = await hitN(1, "/search/users", { client: "search-c4B" });
    expect(rB[0].status).toBe(200);
  });
});

// ============================================================
// 2. UPLOADS LIMITER (3 uploads/min en test)
// ============================================================

describe("Rate Limiting — Uploads (3/min)", () => {
  const PNG_BUFFER = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64"
  );

  async function uploadAvatar(client: string) {
    return request(app)
      .post("/uploads/avatar")
      .set(authHeader(tokenBuyer))
      .set("x-test-client", client)
      .set("x-test-ratelimit", "active")
      .attach("file", PNG_BUFFER, "avatar.png");
  }

  it("PAS de rate limit si header absent", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await request(app)
        .post("/uploads/avatar")
        .set(authHeader(tokenBuyer))
        .attach("file", PNG_BUFFER, "avatar.png");

      expect(r.status).not.toBe(429);
    }
  });

  it("1ère requête OK", async () => {
    const r = await uploadAvatar("up-c1");
    expect(r.status).toBe(200);
  });

  it("jusqu'à 3 uploads OK", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await uploadAvatar("up-c2");
      expect(r.status).toBe(200);
    }
  });

  it("4ème upload → 429", async () => {
    for (let i = 0; i < 3; i++) {
      await uploadAvatar("up-c3");
    }
    const r = await uploadAvatar("up-c3");
    expect(r.status).toBe(429);
    expect(r.body.success).toBe(false);
  });

  it("clients différents isolés", async () => {
    for (let i = 0; i < 3; i++) {
      await uploadAvatar("up-c4A");
    }
    const rA = await uploadAvatar("up-c4A");
    expect(rA.status).toBe(429);

    const rB = await uploadAvatar("up-c4B");
    expect(rB.status).toBe(200);
  });
});

// ============================================================
// 3. REFUNDS LIMITER (2 demandes/h en test)
// ============================================================

describe("Rate Limiting — Refunds (2/h)", () => {
  async function requestRefund(client: string) {
    return request(app)
      .post("/refunds/request")
      .set(authHeader(tokenBuyer))
      .set("x-test-client", client)
      .set("x-test-ratelimit", "active")
      .send({
        order_id: orderId,
        reason: "Test rate limit remboursement",
      });
  }

  it("PAS de rate limit si header absent", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post("/refunds/request")
        .set(authHeader(tokenBuyer))
        .send({ order_id: orderId, reason: "Test skip rate limit" });

      expect(r.status).not.toBe(429);
    }
  });

  it("1ère demande OK (ou 400 si déjà en cours)", async () => {
    const r = await requestRefund("rf-c1");
    expect([201, 400]).toContain(r.status);
    expect(r.status).not.toBe(429);
  });

  it("jusqu'à 2 demandes : pas de 429", async () => {
    const r1 = await requestRefund("rf-c2");
    const r2 = await requestRefund("rf-c2");

    expect(r1.status).not.toBe(429);
    expect(r2.status).not.toBe(429);
  });

  it("3ème demande → 429", async () => {
    await requestRefund("rf-c3");
    await requestRefund("rf-c3");
    const r3 = await requestRefund("rf-c3");

    expect(r3.status).toBe(429);
    expect(r3.body.success).toBe(false);
  });

  it("clients différents isolés", async () => {
    await requestRefund("rf-c4A");
    await requestRefund("rf-c4A");
    const rA = await requestRefund("rf-c4A");
    expect(rA.status).toBe(429);

    const rB = await requestRefund("rf-c4B");
    expect(rB.status).not.toBe(429);
  });
});

// ============================================================
// 4. CHECKOUT LIMITER (2 paiements/h en test)
// ============================================================

describe("Rate Limiting — Checkout (2/h)", () => {
  async function checkout(client: string) {
    return request(app)
      .post("/payments/checkout")
      .set(authHeader(tokenBuyer))
      .set("x-test-client", client)
      .set("x-test-ratelimit", "active")
      .send({ order_id: orderId });
  }

  it("PAS de rate limit si header absent", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post("/payments/checkout")
        .set(authHeader(tokenBuyer))
        .send({ order_id: orderId });

      expect(r.status).not.toBe(429);
    }
  });

  it("1ère tentative : pas de 429", async () => {
    const r = await checkout("co-c1");
    expect(r.status).not.toBe(429);
  });

  it("jusqu'à 2 tentatives : pas de 429", async () => {
    const r1 = await checkout("co-c2");
    const r2 = await checkout("co-c2");
    expect(r1.status).not.toBe(429);
    expect(r2.status).not.toBe(429);
  });

  it("3ème tentative → 429", async () => {
    await checkout("co-c3");
    await checkout("co-c3");
    const r3 = await checkout("co-c3");

    expect(r3.status).toBe(429);
    expect(r3.body.success).toBe(false);
  });

  it("clients différents isolés", async () => {
    await checkout("co-c4A");
    await checkout("co-c4A");
    const rA = await checkout("co-c4A");
    expect(rA.status).toBe(429);

    const rB = await checkout("co-c4B");
    expect(rB.status).not.toBe(429);
  });
});
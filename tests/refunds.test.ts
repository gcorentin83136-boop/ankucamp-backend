// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Refunds
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
  notifications,
} from "../src/core/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// MOCK STRIPE (config/stripe)
// ============================================================

vi.mock("../src/config/stripe", () => {
  const mockStripe = {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_test_mock",
          url: "https://checkout.stripe.com/mock",
        }),
      },
    },
    accounts: {
      create: vi.fn().mockResolvedValue({ id: "acct_test_mock" }),
      retrieve: vi.fn().mockResolvedValue({
        id: "acct_test_mock",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    },
    accountLinks: {
      create: vi.fn().mockResolvedValue({
        url: "https://connect.stripe.com/mock",
      }),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({
        id: "re_test_mock_refund",
        status: "succeeded",
      }),
    },
  };

  return { stripe: mockStripe };
});

// ============================================================
// MOCK EMAILS (orders.emails)
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
let adminId: number;

let tokenSeller: string;
let tokenBuyer: string;
let tokenOther: string;
let tokenAdmin: string;

let shopId: number;
let productId: number;

let orderId: number; // Order payée (payment succeeded)
let orderUnpaidId: number; // Order pending sans payment
let orderOtherId: number; // Order d'un autre buyer

// ============================================================
// HELPERS
// ============================================================

async function upsertUser(opts: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role?: "particulier" | "professionnel" | "admin";
  stripe_account_id?: string | null;
  stripe_account_status?: string;
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
        stripe_account_id: opts.stripe_account_id ?? null,
        stripe_account_status: opts.stripe_account_status ?? "not_connected",
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
        stripe_account_id: opts.stripe_account_id ?? null,
        stripe_account_status: opts.stripe_account_status ?? "not_connected",
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
  // Cleanup préalable
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "reftest_seller@test.com",
        "reftest_buyer@test.com",
        "reftest_other@test.com",
        "reftest_admin@test.com",
      ])
    );

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);

    // Supprime refunds
    const oldRefunds = await db
      .select({ id: refundRequests.id })
      .from(refundRequests)
      .where(inArray(refundRequests.requested_by, ids));
    if (oldRefunds.length > 0) {
      const refundIds = oldRefunds.map((r) => r.id);
      await db
        .delete(refundRequests)
        .where(inArray(refundRequests.id, refundIds));
    }

    // Supprime payments + orders + items
    const oldOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.buyer_id, ids));
    if (oldOrders.length > 0) {
      const orderIds = oldOrders.map((o) => o.id);
      await db.delete(payments).where(inArray(payments.order_id, orderIds));
      await db
        .delete(orderItems)
        .where(inArray(orderItems.order_id, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    // Supprime products + shops
    const oldShops = await db
      .select({ id: shops.id })
      .from(shops)
      .where(inArray(shops.owner_id, ids));
    if (oldShops.length > 0) {
      const shopIds = oldShops.map((s) => s.id);
      await db.delete(products).where(inArray(products.shop_id, shopIds));
      await db.delete(shops).where(inArray(shops.id, shopIds));
    }

    await db
      .delete(notifications)
      .where(inArray(notifications.user_id, ids));
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  // Crée les users
  sellerId = await upsertUser({
    email: "reftest_seller@test.com",
    username: "reftest_seller",
    first_name: "Seller",
    last_name: "Refund",
    role: "professionnel",
    stripe_account_id: "acct_test_seller",
    stripe_account_status: "active",
  });

  buyerId = await upsertUser({
    email: "reftest_buyer@test.com",
    username: "reftest_buyer",
    first_name: "Buyer",
    last_name: "Refund",
  });

  otherId = await upsertUser({
    email: "reftest_other@test.com",
    username: "reftest_other",
    first_name: "Other",
    last_name: "Refund",
  });

  adminId = await upsertUser({
    email: "reftest_admin@test.com",
    username: "reftest_admin",
    first_name: "Admin",
    last_name: "Refund",
    role: "admin",
  });

  tokenSeller = await login("reftest_seller@test.com");
  tokenBuyer = await login("reftest_buyer@test.com");
  tokenOther = await login("reftest_other@test.com");
  tokenAdmin = await login("reftest_admin@test.com");

  // Crée shop + product
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop Refund Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [prod] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit Refund Test",
      price: "29.99",
      stock: 5,
    })
    .returning();
  productId = prod.id;

  // Crée 3 orders
  // Order 1 : payée (payment succeeded)
  const [o1] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "29.99",
      status: "confirmed",
      delivery_method: "standard",
    })
    .returning();
  orderId = o1.id;

  await db.insert(orderItems).values({
    order_id: orderId,
    product_id: productId,
    quantity: 2,
    unit_price: "29.99",
  });

  await db.insert(payments).values({
    order_id: orderId,
    user_id: buyerId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_refundable",
    stripe_session_id: "cs_test_refundable",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "29.99",
    tva_rate: "0",
    application_fee_amount: "0.75",
    seller_amount: "29.24",
    status: "succeeded",
  });

  // Order 2 : non payée (pending, pas de payment)
  const [o2] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "29.99",
      status: "pending",
      delivery_method: "standard",
    })
    .returning();
  orderUnpaidId = o2.id;

  // Order 3 : payée mais d'un autre buyer
  const [o3] = await db
    .insert(orders)
    .values({
      buyer_id: otherId,
      seller_id: sellerId,
      total_price: "29.99",
      status: "confirmed",
      delivery_method: "standard",
    })
    .returning();
  orderOtherId = o3.id;

  await db.insert(payments).values({
    order_id: orderOtherId,
    user_id: otherId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_other",
    stripe_session_id: "cs_test_other",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "29.99",
    tva_rate: "0",
    application_fee_amount: "0.75",
    seller_amount: "29.24",
    status: "succeeded",
  });
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, buyerId, otherId, adminId];

    await db
      .delete(refundRequests)
      .where(inArray(refundRequests.requested_by, userIds));
    await db
      .delete(refundRequests)
      .where(inArray(refundRequests.admin_id, userIds));

    const allOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.buyer_id, userIds));

    if (allOrders.length > 0) {
      const orderIds = allOrders.map((o) => o.id);
      await db.delete(payments).where(inArray(payments.order_id, orderIds));
      await db
        .delete(orderItems)
        .where(inArray(orderItems.order_id, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }

    await db.delete(products).where(inArray(products.shop_id, [shopId]));
    await db.delete(shops).where(eq(shops.id, shopId));

    await db
      .delete(notifications)
      .where(inArray(notifications.user_id, userIds));
    await db.delete(userSessions).where(inArray(userSessions.user_id, userIds));
    await db.delete(userSettings).where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. POST /refunds/request
// ============================================================

describe("Refunds — POST /refunds/request", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .send({ order_id: orderId, reason: "Test test test" });

    expect(res.status).toBe(401);
  });

  it("rejette un body invalide (400)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenBuyer))
      .send({ order_id: "abc", reason: "Test" });

    expect(res.status).toBe(400);
  });

  it("rejette une raison trop courte (400)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId, reason: "abc" });

    expect(res.status).toBe(400);
  });

  it("rejette si order inexistante (404)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenBuyer))
      .send({ order_id: 999999, reason: "Test test test test" });

    expect(res.status).toBe(404);
  });

  it("rejette si pas l'acheteur (403)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenOther))
      .send({ order_id: orderId, reason: "Test test test test" });

    expect(res.status).toBe(403);
  });

  it("rejette si pas de paiement (400)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderUnpaidId, reason: "Test test test test" });

    expect(res.status).toBe(400);
  });

  it("crée une demande (201)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenBuyer))
      .send({
        order_id: orderId,
        reason: "Produit non conforme à la description",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.refund).toHaveProperty("id");
    expect(res.body.refund.status).toBe("pending");
    expect(res.body.refund.refund_amount).toBe("29.99");
  });

  it("crée bien une ligne en DB", async () => {
    const rows = await db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.order_id, orderId));

    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].requested_by).toBe(buyerId);
  });

  it("rejette un doublon (400)", async () => {
    const res = await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId, reason: "Nouvelle demande test" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 2. GET /refunds/me
// ============================================================

describe("Refunds — GET /refunds/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/refunds/me");
    expect(res.status).toBe(401);
  });

  it("retourne mes demandes", async () => {
    const res = await request(app)
      .get("/refunds/me")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.refunds)).toBe(true);
    expect(res.body.refunds.length).toBeGreaterThanOrEqual(1);
  });

  it("retourne 0 pour un user sans demande", async () => {
    const res = await request(app)
      .get("/refunds/me")
      .set(authHeader(tokenOther));

    expect(res.body.refunds.length).toBe(0);
  });
});

// ============================================================
// 3. GET /refunds (admin)
// ============================================================

describe("Refunds — GET /refunds (admin)", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/refunds");
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .get("/refunds")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("retourne toutes les demandes (admin)", async () => {
    const res = await request(app)
      .get("/refunds")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.refunds)).toBe(true);
    expect(res.body.refunds.length).toBeGreaterThanOrEqual(1);
  });

  it("accepte un filtre par status", async () => {
    const res = await request(app)
      .get("/refunds?status=pending")
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
    for (const r of res.body.refunds) {
      expect(r.status).toBe("pending");
    }
  });
});

// ============================================================
// 4. GET /refunds/:id
// ============================================================

describe("Refunds — GET /refunds/:id", () => {
  let refundId: number;

  beforeAll(async () => {
    const [r] = await db
      .select({ id: refundRequests.id })
      .from(refundRequests)
      .where(eq(refundRequests.order_id, orderId))
      .limit(1);
    refundId = r.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app).get(`/refunds/${refundId}`);
    expect(res.status).toBe(401);
  });

  it("retourne la demande au buyer (200)", async () => {
    const res = await request(app)
      .get(`/refunds/${refundId}`)
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.refund.id).toBe(refundId);
  });

  it("retourne la demande à l'admin (200)", async () => {
    const res = await request(app)
      .get(`/refunds/${refundId}`)
      .set(authHeader(tokenAdmin));

    expect(res.status).toBe(200);
  });

  it("rejette un autre user (403)", async () => {
    const res = await request(app)
      .get(`/refunds/${refundId}`)
      .set(authHeader(tokenOther));

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 5. PUT /refunds/:id/reject (admin)
// ============================================================

describe("Refunds — PUT /refunds/:id/reject", () => {
  let refundId: number;

  beforeAll(async () => {
    // Crée une nouvelle demande pour tester reject
    // (on utilise orderOtherId qui n'a pas encore de demande)
    await request(app)
      .post("/refunds/request")
      .set(authHeader(tokenOther))
      .send({
        order_id: orderOtherId,
        reason: "Autre raison de test de rejet",
      });

    const [r] = await db
      .select({ id: refundRequests.id })
      .from(refundRequests)
      .where(eq(refundRequests.order_id, orderOtherId))
      .limit(1);
    refundId = r.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put(`/refunds/${refundId}/reject`)
      .send({ admin_comment: "Test" });
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .put(`/refunds/${refundId}/reject`)
      .set(authHeader(tokenBuyer))
      .send({ admin_comment: "Test" });
    expect(res.status).toBe(403);
  });

  it("rejette la demande (200)", async () => {
    const res = await request(app)
      .put(`/refunds/${refundId}/reject`)
      .set(authHeader(tokenAdmin))
      .send({ admin_comment: "Raison insuffisante" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("rejected");
  });

  it("statut devient rejected en DB", async () => {
    const [r] = await db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, refundId))
      .limit(1);

    expect(r.status).toBe("rejected");
    expect(r.admin_id).toBe(adminId);
    expect(r.admin_comment).toBe("Raison insuffisante");
  });
});

// ============================================================
// 6. PUT /refunds/:id/approve (admin)
// ============================================================

describe("Refunds — PUT /refunds/:id/approve", () => {
  let refundId: number;
  let stockBefore: number;

  beforeAll(async () => {
    // Récupère la demande pending sur orderId
    const [r] = await db
      .select({ id: refundRequests.id })
      .from(refundRequests)
      .where(eq(refundRequests.order_id, orderId))
      .limit(1);
    refundId = r.id;

    // Sauvegarde le stock actuel pour vérifier après
    const [prod] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    stockBefore = prod?.stock ?? 0;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put(`/refunds/${refundId}/approve`)
      .send({ admin_comment: "OK" });
    expect(res.status).toBe(401);
  });

  it("rejette si pas admin (403)", async () => {
    const res = await request(app)
      .put(`/refunds/${refundId}/approve`)
      .set(authHeader(tokenBuyer))
      .send({ admin_comment: "OK" });
    expect(res.status).toBe(403);
  });

  it("approuve la demande (200)", async () => {
    const res = await request(app)
      .put(`/refunds/${refundId}/approve`)
      .set(authHeader(tokenAdmin))
      .send({ admin_comment: "Approuvé après vérification" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("approved");
    expect(res.body.stripe_refund_id).toBe("re_test_mock_refund");
  });

  it("statut devient approved en DB", async () => {
    const [r] = await db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, refundId))
      .limit(1);

    expect(r.status).toBe("approved");
    expect(r.stripe_refund_id).toBe("re_test_mock_refund");
    expect(r.admin_id).toBe(adminId);
  });

  it("payment status devient refunded", async () => {
    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.order_id, orderId))
      .limit(1);

    expect(p.status).toBe("refunded");
  });

  it("order status devient refunded", async () => {
    const [o] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    expect(o.status).toBe("refunded");
  });

  it("stock remis automatiquement (+2)", async () => {
    const [prod] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    expect(prod.stock).toBe(stockBefore + 2);
  });

  it("rejette une 2ème approbation (400)", async () => {
    const res = await request(app)
      .put(`/refunds/${refundId}/approve`)
      .set(authHeader(tokenAdmin))
      .send({ admin_comment: "Encore" });

    expect(res.status).toBe(400);
  });

  it("vérifie les paramètres Stripe (reverse_transfer + refund_application_fee)", async () => {
    const { stripe } = await import("../src/config/stripe");
    const mockCreate = vi.mocked(stripe.refunds.create);

    expect(mockCreate).toHaveBeenCalled();
    const callParams = mockCreate.mock.calls[0][0] as any;

    expect(callParams.payment_intent).toBe("pi_test_refundable");
    expect(callParams.reverse_transfer).toBe(true);
    expect(callParams.refund_application_fee).toBe(true);
  });
});

// ============================================================
// 7. Webhook charge.refunded
// ============================================================

describe("Refunds — Webhook charge.refunded", () => {
  let refundId: number;

  beforeAll(async () => {
    // Crée une demande approuvée pour tester le webhook
    const [r] = await db
      .select({ id: refundRequests.id })
      .from(refundRequests)
      .where(eq(refundRequests.order_id, orderId))
      .limit(1);
    refundId = r.id;
  });

  it("met à jour le statut → refunded (webhook)", async () => {
    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_test_mock",
          refunds: {
            data: [{ id: "re_test_mock_refund" }],
          },
        },
      },
    } as any);

    const res = await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    expect(res.status).toBe(200);

    const [r] = await db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, refundId))
      .limit(1);

    expect(r.status).toBe("refunded");
  });

  it("idempotence : 2ème webhook identique → skip", async () => {
    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_test_mock",
          refunds: {
            data: [{ id: "re_test_mock_refund" }],
          },
        },
      },
    } as any);

    const res = await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    expect(res.status).toBe(200);

    // Le statut reste refunded (pas de changement)
    const [r] = await db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, refundId))
      .limit(1);

    expect(r.status).toBe("refunded");
  });

  it("gère un refund_request introuvable (no-op)", async () => {
    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_unknown",
          refunds: {
            data: [{ id: "re_unknown_xyz" }],
          },
        },
      },
    } as any);

    const res = await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    expect(res.status).toBe(200);
  });
});
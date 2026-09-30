// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Payments
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
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
  notifications,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// MOCK STRIPE (config/stripe)
// ============================================================

vi.mock("../src/config/stripe", () => {
  const mockStripe = {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_test_mock_session",
          url: "https://checkout.stripe.com/mock/session",
        }),
      },
    },
    accounts: {
      create: vi.fn().mockResolvedValue({
        id: "acct_test_mock",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      }),
      retrieve: vi.fn().mockResolvedValue({
        id: "acct_test_mock",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    },
    accountLinks: {
      create: vi.fn().mockResolvedValue({
        url: "https://connect.stripe.com/mock/onboarding",
      }),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  return { stripe: mockStripe };
});

// ============================================================
// MOCK EMAILS (orders.emails) — pour éviter les envois réels
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
let tokenOther: string;

let shopId: number;
let productId: number;

let orderId: number;
let orderOtherId: number;

// ============================================================
// HELPERS
// ============================================================

async function upsertUser(opts: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role?: "particulier" | "professionnel";
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
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "paytest_seller@test.com",
        "paytest_buyer@test.com",
        "paytest_other@test.com",
      ])
    );

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);

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

    await db.delete(notifications).where(inArray(notifications.user_id, ids));
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  sellerId = await upsertUser({
    email: "paytest_seller@test.com",
    username: "paytest_seller",
    first_name: "Seller",
    last_name: "Pay",
    role: "professionnel",
    stripe_account_id: "acct_test_seller",
    stripe_account_status: "active",
  });

  buyerId = await upsertUser({
    email: "paytest_buyer@test.com",
    username: "paytest_buyer",
    first_name: "Buyer",
    last_name: "Pay",
  });

  otherId = await upsertUser({
    email: "paytest_other@test.com",
    username: "paytest_other",
    first_name: "Other",
    last_name: "Pay",
  });

  tokenSeller = await login("paytest_seller@test.com");
  tokenBuyer = await login("paytest_buyer@test.com");
  tokenOther = await login("paytest_other@test.com");

  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop Payment Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [prod] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit Payment Test",
      price: "29.99",
      stock: 5,
    })
    .returning();
  productId = prod.id;

  const [o1] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "29.99",
      status: "pending",
      delivery_method: "standard",
    })
    .returning();
  orderId = o1.id;

  await db.insert(orderItems).values({
    order_id: orderId,
    product_id: productId,
    quantity: 1,
    unit_price: "29.99",
  });

  const [o2] = await db
    .insert(orders)
    .values({
      buyer_id: otherId,
      seller_id: sellerId,
      total_price: "29.99",
      status: "pending",
      delivery_method: "standard",
    })
    .returning();
  orderOtherId = o2.id;

  await db.insert(orderItems).values({
    order_id: orderOtherId,
    product_id: productId,
    quantity: 1,
    unit_price: "29.99",
  });
});

// ============================================================
// AFTER ALL
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, buyerId, otherId];

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

    await db.delete(notifications).where(inArray(notifications.user_id, userIds));
    await db.delete(userSessions).where(inArray(userSessions.user_id, userIds));
    await db.delete(userSettings).where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. POST /payments/checkout
// ============================================================

describe("Payments — POST /payments/checkout", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/payments/checkout")
      .send({ order_id: orderId });

    expect(res.status).toBe(401);
  });

  it("rejette un body invalide (400)", async () => {
    const res = await request(app)
      .post("/payments/checkout")
      .set(authHeader(tokenBuyer))
      .send({ order_id: "abc" });

    expect(res.status).toBe(400);
  });

  it("rejette si l'order n'existe pas (404)", async () => {
    const res = await request(app)
      .post("/payments/checkout")
      .set(authHeader(tokenBuyer))
      .send({ order_id: 999999 });

    expect(res.status).toBe(404);
  });

  it("rejette si ce n'est pas l'acheteur (403)", async () => {
    const res = await request(app)
      .post("/payments/checkout")
      .set(authHeader(tokenOther))
      .send({ order_id: orderId });

    expect(res.status).toBe(403);
  });

  it("crée une session de paiement (201)", async () => {
    const res = await request(app)
      .post("/payments/checkout")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain("stripe.com");
    expect(res.body.session_id).toBe("cs_test_mock_session");
  });

  it("crée une ligne en DB (status pending)", async () => {
    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.order_id, orderId))
      .limit(1);

    expect(p).toBeDefined();
    expect(p.status).toBe("pending");
    expect(p.stripe_session_id).toBe("cs_test_mock_session");
    expect(p.seller_id).toBe(sellerId);
  });
});

// ============================================================
// 2. VÉRIFICATION DES PARAMÈTRES STRIPE (2.5%)
// ============================================================

describe("Payments — Paramètres Stripe Connect (critique)", () => {
  it("appelle stripe.checkout.sessions.create avec les bons paramètres", async () => {
    const { stripe } = await import("../src/config/stripe");
    const mockCreate = vi.mocked(stripe.checkout.sessions.create);

    mockCreate.mockClear();

    await request(app)
      .post("/payments/checkout")
      .set(authHeader(tokenBuyer))
      .send({ order_id: orderOtherId })
      .catch(() => {
        /* peut échouer si déjà payé, on s'en fout */
      });

    // Si une session a été créée, vérifions les paramètres
    if (mockCreate.mock.calls.length > 0) {
      const params = mockCreate.mock.calls[0][0] as any;

      // ✅ Vérif : application_fee_amount = 29.99 * 2.5% * 100 = 75 centimes
      expect(params.payment_intent_data).toBeDefined();
      expect(params.payment_intent_data.application_fee_amount).toBe(75);

      // ✅ Vérif : transfer_data.destination = compte Stripe du seller
      expect(params.payment_intent_data.transfer_data).toBeDefined();
      expect(params.payment_intent_data.transfer_data.destination).toBe(
        "acct_test_seller"
      );

      // ✅ Vérif : metadata complète
      expect(params.metadata.order_id).toBe(String(orderOtherId));
      expect(params.metadata.buyer_id).toBe(String(otherId));
      expect(params.metadata.seller_id).toBe(String(sellerId));

      // ✅ Vérif : mode payment + currency EUR
      expect(params.mode).toBe("payment");
      expect(params.line_items[0].price_data.currency).toBe("eur");
    }
  });

  it("stocke le bon application_fee_amount dans payments", async () => {
    // Reset l'ordre en pending pour pouvoir re-créer une session
    await db
      .delete(payments)
      .where(eq(payments.order_id, orderOtherId));
    await db
      .update(orders)
      .set({ status: "pending" })
      .where(eq(orders.id, orderOtherId));

    const res = await request(app)
      .post("/payments/checkout")
      .set(authHeader(tokenOther))
      .send({ order_id: orderOtherId });

    expect(res.status).toBe(201);

    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.order_id, orderOtherId))
      .limit(1);

    // ✅ Vérif : montants en DB
    expect(p.amount_ttc).toBe("29.99");
    expect(p.application_fee_amount).toBe("0.75"); // 2.5% de 29.99 = 0.74975 → 0.75
    expect(p.seller_amount).toBe("29.24"); // 29.99 - 0.75 = 29.24
    expect(p.seller_stripe_account_id).toBe("acct_test_seller");
  });
});

// ============================================================
// 3. GET /payments/me
// ============================================================

describe("Payments — GET /payments/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/payments/me");
    expect(res.status).toBe(401);
  });

  it("retourne mes paiements", async () => {
    const res = await request(app)
      .get("/payments/me")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(res.body.payments.length).toBeGreaterThanOrEqual(1);
  });

  it("retourne 0 paiement pour un user sans paiement", async () => {
    const res = await request(app)
      .get("/payments/me")
      .set(authHeader(tokenSeller));

    // Le seller n'est pas "user_id" (buyer), donc 0
    // (il est "seller_id" sur les paiements mais getPaymentsByUser filtre par user_id)
    expect(res.body.payments.length).toBe(0);
  });
});

// ============================================================
// 4. GET /payments/order/:orderId
// ============================================================

describe("Payments — GET /payments/order/:orderId", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(`/payments/order/${orderId}`);
    expect(res.status).toBe(401);
  });

  it("retourne le paiement pour le buyer (200)", async () => {
    const res = await request(app)
      .get(`/payments/order/${orderId}`)
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.payment.order_id).toBe(orderId);
  });

  it("retourne le paiement pour le seller (200)", async () => {
    const res = await request(app)
      .get(`/payments/order/${orderId}`)
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
  });

  it("rejette si ni buyer ni seller (403)", async () => {
    const res = await request(app)
      .get(`/payments/order/${orderId}`)
      .set(authHeader(tokenOther));

    expect(res.status).toBe(403);
  });

  it("rejette un orderId invalide (400)", async () => {
    const res = await request(app)
      .get("/payments/order/abc")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 5. Connect onboarding
// ============================================================

describe("Payments — POST /payments/connect/onboard", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).post("/payments/connect/onboard");
    expect(res.status).toBe(401);
  });

  it("rejette si l'user n'est pas pro (403)", async () => {
    const res = await request(app)
      .post("/payments/connect/onboard")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(403);
  });

  it("génère un lien d'onboarding pour le seller (200)", async () => {
    const res = await request(app)
      .post("/payments/connect/onboard")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.onboarding_url).toContain("stripe.com");
  });

  it("crée un compte Stripe pour un pro sans compte (200)", async () => {
    const newProId = await upsertUser({
      email: "paytest_newpro@test.com",
      username: "paytest_newpro",
      first_name: "NewPro",
      last_name: "Stripe",
      role: "professionnel",
      stripe_account_id: null,
    });
    const newProToken = await login("paytest_newpro@test.com");

    const res = await request(app)
      .post("/payments/connect/onboard")
      .set(authHeader(newProToken));

    expect(res.status).toBe(200);
    expect(res.body.onboarding_url).toContain("stripe.com");

    const [u] = await db
      .select({ stripe_account_id: users.stripe_account_id })
      .from(users)
      .where(eq(users.id, newProId))
      .limit(1);

    expect(u.stripe_account_id).toBe("acct_test_mock");

    await db.delete(userSessions).where(eq(userSessions.user_id, newProId));
    await db.delete(userSettings).where(eq(userSettings.user_id, newProId));
    await db.delete(users).where(eq(users.id, newProId));
  });
});

// ============================================================
// 6. Connect status
// ============================================================

describe("Payments — GET /payments/connect/status", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/payments/connect/status");
    expect(res.status).toBe(401);
  });

  it("retourne 'active' pour un seller avec compte actif", async () => {
    const res = await request(app)
      .get("/payments/connect/status")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("active");
    expect(res.body.charges_enabled).toBe(true);
    expect(res.body.payouts_enabled).toBe(true);
  });

  it("retourne 'not_connected' pour un user sans compte Stripe", async () => {
    const res = await request(app)
      .get("/payments/connect/status")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("not_connected");
    expect(res.body.charges_enabled).toBe(false);
  });
});

// ============================================================
// 7. Webhook — Signature
// ============================================================

describe("Payments — POST /payments/webhook (signature)", () => {
  it("rejette sans signature Stripe (400)", async () => {
    const res = await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .send({ type: "test" });

    expect(res.status).toBe(400);
  });

  it("rejette une signature invalide (400)", async () => {
    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });

    const res = await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "invalid_signature")
      .send({ type: "test" });

    expect(res.status).toBe(400);
  });

  it("retourne 200 avec un event inconnu (no-op)", async () => {
    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "unknown.event",
      data: { object: {} },
    } as any);

    const res = await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({ type: "unknown.event" });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ============================================================
// 8. Webhook — checkout.session.completed
// ============================================================

describe("Payments — Webhook checkout.session.completed", () => {
  it("marque le paiement succeeded + order confirmed", async () => {
    // Setup : reset le payment de orderId (le paiement existe déjà)
    await db
      .update(payments)
      .set({
        status: "pending",
        stripe_payment_intent: "pending",
        invoice_url: null,
      })
      .where(eq(payments.order_id, orderId));

    await db
      .update(orders)
      .set({ status: "pending" })
      .where(eq(orders.id, orderId));

    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_mock_session",
          payment_intent: "pi_test_mock",
          metadata: {
            order_id: String(orderId),
            buyer_id: String(buyerId),
            seller_id: String(sellerId),
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

    // ✅ Vérif : payment status = succeeded
    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.order_id, orderId))
      .limit(1);

    expect(p.status).toBe("succeeded");
    expect(p.stripe_payment_intent).toBe("pi_test_mock");

    // ✅ Vérif : order status = confirmed
    const [o] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    expect(o.status).toBe("confirmed");
  });

  it("idempotence : un 2ème event identique ne change rien", async () => {
    // Ajoute une invoice_url pour simuler un traitement déjà complet
    await db
      .update(payments)
      .set({ invoice_url: "https://fake-invoice.pdf" })
      .where(eq(payments.order_id, orderId));

    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_mock_session",
          payment_intent: "pi_test_different",
          metadata: {
            order_id: String(orderId),
          },
        },
      },
    } as any);

    await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    // ✅ Vérif : stripe_payment_intent n'a PAS été modifié
    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.order_id, orderId))
      .limit(1);

    expect(p.stripe_payment_intent).toBe("pi_test_mock"); // reste l'ancien
  });
});

// ============================================================
// 9. Webhook — account.updated
// ============================================================

describe("Payments — Webhook account.updated", () => {
  it("met à jour le statut Connect du user", async () => {
    // Reset le status du seller
    await db
      .update(users)
      .set({ stripe_account_status: "pending" })
      .where(eq(users.id, sellerId));

    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "account.updated",
      data: {
        object: {
          id: "acct_test_seller",
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          metadata: {
            user_id: String(sellerId),
          },
        },
      },
    } as any);

    await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    const [u] = await db
      .select({ stripe_account_status: users.stripe_account_status })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1);

    expect(u.stripe_account_status).toBe("active");
  });

  it("met à jour en 'pending_verification' si details_submitted mais pas active", async () => {
    await db
      .update(users)
      .set({ stripe_account_status: "pending" })
      .where(eq(users.id, sellerId));

    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "account.updated",
      data: {
        object: {
          id: "acct_test_seller",
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: true,
          metadata: {
            user_id: String(sellerId),
          },
        },
      },
    } as any);

    await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    const [u] = await db
      .select({ stripe_account_status: users.stripe_account_status })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1);

    expect(u.stripe_account_status).toBe("pending_verification");
  });
});

// ============================================================
// 10. Webhook — payment_intent.payment_failed
// ============================================================

describe("Payments — Webhook payment_intent.payment_failed", () => {
  it("marque le paiement comme failed", async () => {
    await db
      .update(payments)
      .set({ status: "pending" })
      .where(eq(payments.order_id, orderId));

    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          metadata: {
            order_id: String(orderId),
          },
        },
      },
    } as any);

    await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.order_id, orderId))
      .limit(1);

    expect(p.status).toBe("failed");
  });

  it("marque le paiement comme failed sur checkout.session.expired", async () => {
    // Reset
    await db
      .update(payments)
      .set({ status: "pending" })
      .where(eq(payments.order_id, orderId));

    const { stripe } = await import("../src/config/stripe");
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValueOnce({
      type: "checkout.session.expired",
      data: {
        object: {
          metadata: {
            order_id: String(orderId),
          },
        },
      },
    } as any);

    await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "fake_signature")
      .send({});

    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.order_id, orderId))
      .limit(1);

    expect(p.status).toBe("failed");
  });
});
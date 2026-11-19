// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Dashboard > Buyer
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
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

vi.mock("../src/core/api/orders/orders.emails", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  resendInvoiceEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
  sendReviewRequestEmail: vi.fn().mockResolvedValue(undefined),
}));

const PASSWORD = "Test1234!";

let sellerId: number;
let buyerId: number;
let otherId: number;

let tokenSeller: string;
let tokenBuyer: string;
let tokenOther: string;

let shopId: number;
let productId: number;

let orderPendingId: number;
let orderConfirmedId: number;
let orderDeliveredId: number;
let orderCancelledId: number;
let orderWithoutInvoiceId: number;
let orderOtherId: number;

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

beforeAll(async () => {
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "dashbuyer_seller@test.com",
        "dashbuyer_buyer@test.com",
        "dashbuyer_other@test.com",
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

    await db.delete(notifications).where(inArray(notifications.user_id, ids));
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  sellerId = await upsertUser({
    email: "dashbuyer_seller@test.com",
    username: "dashbuyer_seller",
    first_name: "Seller",
    last_name: "DashBuyer",
    role: "professionnel",
  });

  buyerId = await upsertUser({
    email: "dashbuyer_buyer@test.com",
    username: "dashbuyer_buyer",
    first_name: "Buyer",
    last_name: "DashBuyer",
  });

  otherId = await upsertUser({
    email: "dashbuyer_other@test.com",
    username: "dashbuyer_other",
    first_name: "Other",
    last_name: "DashBuyer",
  });

  tokenSeller = await login("dashbuyer_seller@test.com");
  tokenBuyer = await login("dashbuyer_buyer@test.com");
  tokenOther = await login("dashbuyer_other@test.com");

  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop Dashboard Buyer Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [prod] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit Dashboard Test",
      price: "50.00",
      stock: 20,
    })
    .returning();
  productId = prod.id;

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
  orderPendingId = o1.id;

  await db.insert(orderItems).values({
    order_id: orderPendingId,
    product_id: productId,
    quantity: 1,
    unit_price: "50.00",
  });

  // Order 2 : confirmed + payment + invoice
  const [o2] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "50.00",
      status: "confirmed",
      delivery_method: "shipping",
    })
    .returning();
  orderConfirmedId = o2.id;

  await db.insert(orderItems).values({
    order_id: orderConfirmedId,
    product_id: productId,
    quantity: 1,
    unit_price: "50.00",
  });

  await db.insert(payments).values({
    order_id: orderConfirmedId,
    user_id: buyerId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_confirmed",
    stripe_session_id: "cs_test_confirmed",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "50.00",
    tva_rate: "0",
    application_fee_amount: "1.25",
    seller_amount: "48.75",
    status: "succeeded",
    invoice_url: "https://cloudinary.com/fake/invoice-confirmed.pdf",
  });

  // Order 3 : delivered + payment + invoice
  const [o3] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "75.00",
      status: "delivered",
      delivery_method: "shipping",
      delivered_at: new Date(),
    })
    .returning();
  orderDeliveredId = o3.id;

  await db.insert(orderItems).values({
    order_id: orderDeliveredId,
    product_id: productId,
    quantity: 1,
    unit_price: "75.00",
  });

  await db.insert(payments).values({
    order_id: orderDeliveredId,
    user_id: buyerId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_delivered",
    stripe_session_id: "cs_test_delivered",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "75.00",
    tva_rate: "0",
    application_fee_amount: "1.88",
    seller_amount: "73.12",
    status: "succeeded",
    invoice_url: "https://cloudinary.com/fake/invoice-delivered.pdf",
  });

  // Order 4 : cancelled
  const [o4] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "30.00",
      status: "cancelled",
      delivery_method: "shipping",
    })
    .returning();
  orderCancelledId = o4.id;

  await db.insert(orderItems).values({
    order_id: orderCancelledId,
    product_id: productId,
    quantity: 1,
    unit_price: "30.00",
  });

  // Order 5 : payée SANS facture
  const [o5] = await db
    .insert(orders)
    .values({
      buyer_id: buyerId,
      seller_id: sellerId,
      total_price: "100.00",
      status: "confirmed",
      delivery_method: "shipping",
    })
    .returning();
  orderWithoutInvoiceId = o5.id;

  await db.insert(orderItems).values({
    order_id: orderWithoutInvoiceId,
    product_id: productId,
    quantity: 1,
    unit_price: "100.00",
  });

  await db.insert(payments).values({
    order_id: orderWithoutInvoiceId,
    user_id: buyerId,
    seller_id: sellerId,
    seller_stripe_account_id: "acct_test_seller",
    stripe_payment_intent: "pi_test_no_invoice",
    stripe_session_id: "cs_test_no_invoice",
    amount_ht: "0",
    amount_tva: "0",
    amount_ttc: "100.00",
    tva_rate: "0",
    application_fee_amount: "2.50",
    seller_amount: "97.50",
    status: "succeeded",
    invoice_url: null,
  });

  // Order 6 : d'un autre buyer
  const [o6] = await db
    .insert(orders)
    .values({
      buyer_id: otherId,
      seller_id: sellerId,
      total_price: "50.00",
      status: "pending",
      delivery_method: "shipping",
    })
    .returning();
  orderOtherId = o6.id;

  await db.insert(orderItems).values({
    order_id: orderOtherId,
    product_id: productId,
    quantity: 1,
    unit_price: "50.00",
  });

  // 1 demande de remboursement du buyer
  await db.insert(refundRequests).values({
    order_id: orderCancelledId,
    payment_id: 0,
    requested_by: buyerId,
    reason: "Test dashboard",
    status: "pending",
    refund_amount: "30.00",
  });
});

afterAll(async () => {
  try {
    const userIds = [sellerId, buyerId, otherId];

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

    await db.delete(notifications).where(inArray(notifications.user_id, userIds));
    await db.delete(userSessions).where(inArray(userSessions.user_id, userIds));
    await db.delete(userSettings).where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /dashboard/buyer/stats
// ============================================================

describe("Dashboard Buyer — GET /dashboard/buyer/stats", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/buyer/stats");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les stats", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/stats")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("orders");
    expect(res.body).toHaveProperty("total_spent");
  });

  it("compte correctement les commandes", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/stats")
      .set(authHeader(tokenBuyer));

    expect(res.body.orders.total).toBe(5);
    expect(res.body.orders.pending).toBe(3);
    expect(res.body.orders.delivered).toBe(1);
    expect(res.body.orders.cancelled).toBe(1);
  });

  it("calcule le total dépensé (seulement succeeded)", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/stats")
      .set(authHeader(tokenBuyer));

    // ✅ FIX : PostgreSQL renvoie "225.00" (format decimal)
    expect(res.body.total_spent).toBe("225.00");
  });

  it("retourne 0 pour un user sans commande", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/stats")
      .set(authHeader(tokenOther));

    expect(res.body.orders.total).toBe(1);
    expect(res.body.total_spent).toBe("0");
  });
});

// ============================================================
// 2. GET /dashboard/buyer/recent-orders
// ============================================================

describe("Dashboard Buyer — GET /dashboard/buyer/recent-orders", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/buyer/recent-orders");
    expect(res.status).toBe(401);
  });

  it("retourne les 5 dernières commandes", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/recent-orders")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBe(5);
  });

  it("ne retourne PAS les commandes des autres", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/recent-orders")
      .set(authHeader(tokenBuyer));

    for (const o of res.body.orders) {
      expect(o.buyer_id).toBe(buyerId);
    }
  });

  it("retourne 1 pour l'autre user (1 order)", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/recent-orders")
      .set(authHeader(tokenOther));

    expect(res.body.orders.length).toBe(1);
  });
});

// ============================================================
// 3. GET /dashboard/buyer/recent-refunds
// ============================================================

describe("Dashboard Buyer — GET /dashboard/buyer/recent-refunds", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/buyer/recent-refunds");
    expect(res.status).toBe(401);
  });

  it("retourne les demandes de remboursement", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/recent-refunds")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.refunds)).toBe(true);
    expect(res.body.refunds.length).toBe(1);
  });

  it("retourne 0 pour un user sans remboursement", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/recent-refunds")
      .set(authHeader(tokenOther));

    expect(res.body.refunds.length).toBe(0);
  });
});

// ============================================================
// 4. GET /dashboard/buyer/invoices
// ============================================================

describe("Dashboard Buyer — GET /dashboard/buyer/invoices", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/buyer/invoices");
    expect(res.status).toBe(401);
  });

  it("retourne les factures (uniquement avec invoice_url)", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/invoices")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.invoices)).toBe(true);
    expect(res.body.invoices.length).toBe(2);
  });

  it("ne retourne PAS les factures sans invoice_url", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/invoices")
      .set(authHeader(tokenBuyer));

    for (const inv of res.body.invoices) {
      expect(inv.invoice_url).not.toBeNull();
    }
  });

  it("contient les champs attendus", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/invoices")
      .set(authHeader(tokenBuyer));

    const inv = res.body.invoices[0];
    expect(inv).toHaveProperty("payment_id");
    expect(inv).toHaveProperty("order_id");
    expect(inv).toHaveProperty("amount_ttc");
    expect(inv).toHaveProperty("invoice_url");
  });

  it("retourne 0 pour un user sans facture", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/invoices")
      .set(authHeader(tokenOther));

    expect(res.body.invoices.length).toBe(0);
  });
});

// ============================================================
// 5. POST /dashboard/buyer/invoices/:orderId/resend
// ============================================================

describe("Dashboard Buyer — POST /dashboard/buyer/invoices/:orderId/resend", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).post(
      `/dashboard/buyer/invoices/${orderConfirmedId}/resend`
    );
    expect(res.status).toBe(401);
  });

  it("rejette un orderId invalide (400)", async () => {
    const res = await request(app)
      .post("/dashboard/buyer/invoices/abc/resend")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(400);
  });

  it("rejette si pas l'acheteur (403)", async () => {
    const res = await request(app)
      .post(`/dashboard/buyer/invoices/${orderConfirmedId}/resend`)
      .set(authHeader(tokenOther));

    expect(res.status).toBe(403);
  });

  it("rejette une commande inexistante (404)", async () => {
    const res = await request(app)
      .post("/dashboard/buyer/invoices/999999/resend")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(404);
  });

  it("rejette si pas de facture disponible (400)", async () => {
    const res = await request(app)
      .post(`/dashboard/buyer/invoices/${orderWithoutInvoiceId}/resend`)
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(400);
  });

  it("renvoie la facture avec succès (200)", async () => {
    const res = await request(app)
      .post(`/dashboard/buyer/invoices/${orderConfirmedId}/resend`)
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBe("dashbuyer_buyer@test.com");
  });
});

// ============================================================
// 6. GET /dashboard/buyer/spending-chart
// ============================================================

describe("Dashboard Buyer — GET /dashboard/buyer/spending-chart", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/dashboard/buyer/spending-chart");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec le graphique", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/spending-chart")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.months).toBe(12);
    expect(Array.isArray(res.body.chart)).toBe(true);
  });

  it("contient les données par mois", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/spending-chart")
      .set(authHeader(tokenBuyer));

    expect(res.body.chart.length).toBeGreaterThanOrEqual(1);

    const first = res.body.chart[0];
    expect(first).toHaveProperty("month");
    expect(first).toHaveProperty("total");
    expect(first).toHaveProperty("count");
  });

  it("accepte un paramètre months personnalisé", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/spending-chart?months=6")
      .set(authHeader(tokenBuyer));

    expect(res.body.months).toBe(6);
  });

  it("rejette months invalide (400)", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/spending-chart?months=100")
      .set(authHeader(tokenBuyer));

    expect(res.status).toBe(400);
  });

  it("retourne 0 pour un user sans dépense", async () => {
    const res = await request(app)
      .get("/dashboard/buyer/spending-chart")
      .set(authHeader(tokenOther));

    expect(res.body.chart.length).toBe(0);
  });
});
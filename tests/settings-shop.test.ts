// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Settings > Shop
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
  shopSettings,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let sellerId: number;
let otherId: number;

let tokenSeller: string;
let tokenOther: string;

let shopId: number;

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
// BEFORE ALL
// ============================================================

beforeAll(async () => {
  // Cleanup préalable
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, ["shopset_seller@test.com", "shopset_other@test.com"]));

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);
    // Supprime les shops associés
    const oldShops = await db
      .select({ id: shops.id })
      .from(shops)
      .where(inArray(shops.owner_id, ids));

    if (oldShops.length > 0) {
      const shopIds = oldShops.map((s) => s.id);
      await db
        .delete(shopSettings)
        .where(inArray(shopSettings.shop_id, shopIds));
      await db.delete(shops).where(inArray(shops.id, shopIds));
    }

    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  sellerId = await upsertUser({
    email: "shopset_seller@test.com",
    username: "shopset_seller",
    first_name: "Seller",
    last_name: "Shop",
    role: "professionnel",
  });

  otherId = await upsertUser({
    email: "shopset_other@test.com",
    username: "shopset_other",
    first_name: "Other",
    last_name: "User",
  });

  tokenSeller = await login("shopset_seller@test.com");
  tokenOther = await login("shopset_other@test.com");

  // Crée le shop du seller
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Boutique Test Settings",
      description: "Boutique pour tester settings/shop",
      city: "Paris",
    })
    .returning();

  shopId = shop.id;
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, otherId];

    await db
      .delete(shopSettings)
      .where(eq(shopSettings.shop_id, shopId));
    await db.delete(shops).where(eq(shops.id, shopId));

    await db
      .delete(userSessions)
      .where(inArray(userSessions.user_id, userIds));
    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /settings/shop/:shopId
// ============================================================

describe("Settings Shop — GET /settings/shop/:shopId", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(`/settings/shop/${shopId}`);
    expect(res.status).toBe(401);
  });

  it("rejette si pas le propriétaire (403)", async () => {
    const res = await request(app)
      .get(`/settings/shop/${shopId}`)
      .set(authHeader(tokenOther));

    expect(res.status).toBe(403);
  });

  it("retourne 200 pour le propriétaire (lazy create)", async () => {
    const res = await request(app)
      .get(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.settings).toHaveProperty("shop_id");
    expect(res.body.settings).toHaveProperty("vacation");
    expect(res.body.settings).toHaveProperty("is_hidden");
    expect(res.body.settings).toHaveProperty("returns");
    expect(res.body.settings).toHaveProperty("contact");
    expect(res.body.settings).toHaveProperty("shipping_zones");
  });

  it("retourne les valeurs par défaut", async () => {
    const res = await request(app)
      .get(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller));

    expect(res.body.settings.vacation.mode).toBe(false);
    expect(res.body.settings.is_hidden).toBe(false);
    expect(res.body.settings.returns.accepts).toBe(false);
    expect(res.body.settings.returns.days).toBe(14);
    expect(res.body.settings.contact.phone).toBe(null);
    expect(res.body.settings.contact.email).toBe(null);
  });

  it("rejette un shopId invalide (400)", async () => {
    const res = await request(app)
      .get("/settings/shop/abc")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(400);
  });

  it("retourne 404 pour un shop inexistant", async () => {
    const res = await request(app)
      .get("/settings/shop/999999")
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 2. PUT /settings/shop/:shopId (update ALL)
// ============================================================

describe("Settings Shop — PUT /settings/shop/:shopId", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}`)
      .send({ is_hidden: true });

    expect(res.status).toBe(401);
  });

  it("rejette si pas le propriétaire (403)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}`)
      .set(authHeader(tokenOther))
      .send({ is_hidden: true });

    expect(res.status).toBe(403);
  });

  it("met à jour plusieurs champs (200)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller))
      .send({
        is_hidden: true,
        accepts_returns: true,
        return_days: 30,
        contact_phone: "+33612345678",
        contact_email: "shop@test.com",
      });

    expect(res.status).toBe(200);
    expect(res.body.settings.is_hidden).toBe(true);
    expect(res.body.settings.returns.accepts).toBe(true);
    expect(res.body.settings.returns.days).toBe(30);
    expect(res.body.settings.contact.phone).toBe("+33612345678");
    expect(res.body.settings.contact.email).toBe("shop@test.com");
  });

  it("reset hidden à false", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller))
      .send({ is_hidden: false });

    expect(res.body.settings.is_hidden).toBe(false);
  });

  it("rejette un return_days > 90 (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller))
      .send({ return_days: 100 });

    expect(res.status).toBe(400);
  });

  it("rejette un contact_email invalide (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller))
      .send({ contact_email: "not-an-email" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 3. PUT /settings/shop/:shopId/vacation
// ============================================================

describe("Settings Shop — PUT /settings/shop/:shopId/vacation", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/vacation`)
      .send({ vacation_mode: true });

    expect(res.status).toBe(401);
  });

  it("rejette si pas le propriétaire (403)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/vacation`)
      .set(authHeader(tokenOther))
      .send({ vacation_mode: true });

    expect(res.status).toBe(403);
  });

  it("active le mode vacances (200)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/vacation`)
      .set(authHeader(tokenSeller))
      .send({
        vacation_mode: true,
        vacation_message: "De retour dans 2 semaines !",
        vacation_until: "2026-12-31T23:59:59.000Z",
      });

    expect(res.status).toBe(200);
    expect(res.body.settings.vacation.mode).toBe(true);
    expect(res.body.settings.vacation.message).toBe("De retour dans 2 semaines !");
    expect(res.body.settings.vacation.until).toBeTruthy();
  });

  it("désactive le mode vacances (200)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/vacation`)
      .set(authHeader(tokenSeller))
      .send({ vacation_mode: false });

    expect(res.status).toBe(200);
    expect(res.body.settings.vacation.mode).toBe(false);
  });

  it("rejette une date invalide (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/vacation`)
      .set(authHeader(tokenSeller))
      .send({
        vacation_mode: true,
        vacation_until: "not-a-date",
      });

    expect(res.status).toBe(400);
  });

  it("rejette un vacation_message > 500 (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/vacation`)
      .set(authHeader(tokenSeller))
      .send({
        vacation_mode: true,
        vacation_message: "a".repeat(501),
      });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. PUT /settings/shop/:shopId/hidden
// ============================================================

describe("Settings Shop — PUT /settings/shop/:shopId/hidden", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/hidden`)
      .send({ is_hidden: true });

    expect(res.status).toBe(401);
  });

  it("rejette si pas le propriétaire (403)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/hidden`)
      .set(authHeader(tokenOther))
      .send({ is_hidden: true });

    expect(res.status).toBe(403);
  });

  it("masque la boutique (200)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/hidden`)
      .set(authHeader(tokenSeller))
      .send({ is_hidden: true });

    expect(res.status).toBe(200);
    expect(res.body.settings.is_hidden).toBe(true);
  });

  it("démasque la boutique (200)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/hidden`)
      .set(authHeader(tokenSeller))
      .send({ is_hidden: false });

    expect(res.status).toBe(200);
    expect(res.body.settings.is_hidden).toBe(false);
  });

  it("rejette un body invalide (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/hidden`)
      .set(authHeader(tokenSeller))
      .send({ is_hidden: "yes" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 5. PUT /settings/shop/:shopId/returns
// ============================================================

describe("Settings Shop — PUT /settings/shop/:shopId/returns", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/returns`)
      .send({ accepts_returns: true });

    expect(res.status).toBe(401);
  });

  it("rejette si pas le propriétaire (403)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/returns`)
      .set(authHeader(tokenOther))
      .send({ accepts_returns: true });

    expect(res.status).toBe(403);
  });

  it("active les retours avec 30 jours (200)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/returns`)
      .set(authHeader(tokenSeller))
      .send({ accepts_returns: true, return_days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.settings.returns.accepts).toBe(true);
    expect(res.body.settings.returns.days).toBe(30);
  });

  it("change juste les days", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/returns`)
      .set(authHeader(tokenSeller))
      .send({ accepts_returns: true, return_days: 7 });

    expect(res.body.settings.returns.days).toBe(7);
  });

  it("rejette return_days négatif (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/returns`)
      .set(authHeader(tokenSeller))
      .send({ accepts_returns: true, return_days: -1 });

    expect(res.status).toBe(400);
  });

  it("rejette return_days > 90 (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/returns`)
      .set(authHeader(tokenSeller))
      .send({ accepts_returns: true, return_days: 91 });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 6. PUT /settings/shop/:shopId/contact
// ============================================================

describe("Settings Shop — PUT /settings/shop/:shopId/contact", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/contact`)
      .send({ contact_phone: "+33600000000" });

    expect(res.status).toBe(401);
  });

  it("rejette si pas le propriétaire (403)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/contact`)
      .set(authHeader(tokenOther))
      .send({ contact_phone: "+33600000000" });

    expect(res.status).toBe(403);
  });

  it("met à jour phone + email (200)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/contact`)
      .set(authHeader(tokenSeller))
      .send({
        contact_phone: "+33611111111",
        contact_email: "hello@myshop.com",
      });

    expect(res.status).toBe(200);
    expect(res.body.settings.contact.phone).toBe("+33611111111");
    expect(res.body.settings.contact.email).toBe("hello@myshop.com");
  });

  it("accepte un email vide → null", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/contact`)
      .set(authHeader(tokenSeller))
      .send({ contact_email: "" });

    expect(res.status).toBe(200);
    expect(res.body.settings.contact.email).toBe(null);
  });

  it("rejette un email invalide (400)", async () => {
    const res = await request(app)
      .put(`/settings/shop/${shopId}/contact`)
      .set(authHeader(tokenSeller))
      .send({ contact_email: "not-an-email" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 7. Persistance DB
// ============================================================

describe("Settings Shop — Persistance", () => {
  it("les changements sont bien en DB", async () => {
    await request(app)
      .put(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller))
      .send({
        is_hidden: true,
        accepts_returns: true,
        return_days: 15,
        contact_email: "persist@test.com",
      });

    const [settings] = await db
      .select()
      .from(shopSettings)
      .where(eq(shopSettings.shop_id, shopId))
      .limit(1);

    expect(settings.is_hidden).toBe(1);
    expect(settings.accepts_returns).toBe(1);
    expect(settings.return_days).toBe(15);
    expect(settings.contact_email).toBe("persist@test.com");
  });

  it("GET retourne les valeurs persistées", async () => {
    const res = await request(app)
      .get(`/settings/shop/${shopId}`)
      .set(authHeader(tokenSeller));

    expect(res.body.settings.is_hidden).toBe(true);
    expect(res.body.settings.returns.days).toBe(15);
    expect(res.body.settings.contact.email).toBe("persist@test.com");
  });
});
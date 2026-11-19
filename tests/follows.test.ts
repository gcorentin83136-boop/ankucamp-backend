// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Follows
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  shops,
  follows,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let sellerId: number; // Propriétaire de la boutique
let userAId: number;
let userBId: number;

let tokenA: string;
let tokenB: string;
let tokenSeller: string;

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
// BEFORE ALL — Setup
// ============================================================

beforeAll(async () => {
  sellerId = await upsertUser({
    email: "followtest_seller@test.com",
    username: "followtest_seller",
    first_name: "Seller",
    last_name: "Follow",
    role: "professionnel",
  });

  userAId = await upsertUser({
    email: "followtest_a@test.com",
    username: "followtest_a",
    first_name: "Alice",
    last_name: "Follow",
  });

  userBId = await upsertUser({
    email: "followtest_b@test.com",
    username: "followtest_b",
    first_name: "Bob",
    last_name: "Follow",
  });

  tokenA = await login("followtest_a@test.com");
  tokenB = await login("followtest_b@test.com");
  tokenSeller = await login("followtest_seller@test.com");

  // Crée un shop pour le seller
  const [existingShop] = await db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.owner_id, sellerId))
    .limit(1);

  if (existingShop) {
    shopId = existingShop.id;
  } else {
    const [created] = await db
      .insert(shops)
      .values({
        owner_id: sellerId,
        name: "Boutique Test Follows",
        description: "Boutique pour tester le module follows",
        city: "Paris",
      })
      .returning();

    shopId = created.id;
  }

  // Cleanup : supprime tous les follows de ce shop + ce seller
  await db.delete(follows).where(eq(follows.shop_id, shopId));
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, userAId, userBId];

    // Supprime les follows
    await db.delete(follows).where(inArray(follows.follower_id, userIds));
    await db.delete(follows).where(eq(follows.shop_id, shopId));

    // Supprime le shop
    await db.delete(shops).where(eq(shops.id, shopId));

    // Supprime les users
    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));

    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. POST /follows/shop/:shopId — Toggle follow
// ============================================================

describe("Follows — POST /follows/shop/:shopId", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).post(`/follows/shop/${shopId}`);
    expect(res.status).toBe(401);
  });

  it("suit une boutique (following = true)", async () => {
    const res = await request(app)
      .post(`/follows/shop/${shopId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.following).toBe(true);
  });

  it("re-toggle → unfollow (following = false)", async () => {
    const res = await request(app)
      .post(`/follows/shop/${shopId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.following).toBe(false);
  });

  it("re-toggle → follow à nouveau (following = true)", async () => {
    const res = await request(app)
      .post(`/follows/shop/${shopId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.following).toBe(true);
  });

  it("rejette si on suit sa propre boutique (400)", async () => {
    const res = await request(app)
      .post(`/follows/shop/${shopId}`)
      .set(authHeader(tokenSeller));

    expect(res.status).toBe(400);
  });

  it("rejette une boutique inexistante (404)", async () => {
    const res = await request(app)
      .post("/follows/shop/999999")
      .set(authHeader(tokenA));

    expect(res.status).toBe(404);
  });

  it("rejette un shopId invalide (400)", async () => {
    const res = await request(app)
      .post("/follows/shop/abc")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 2. GET /follows/shop/:shopId/status
// ============================================================

describe("Follows — GET /follows/shop/:shopId/status", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(
      `/follows/shop/${shopId}/status`
    );
    expect(res.status).toBe(401);
  });

  it("A suit la boutique → following = true", async () => {
    const res = await request(app)
      .get(`/follows/shop/${shopId}/status`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.following).toBe(true);
  });

  it("B ne suit pas → following = false", async () => {
    const res = await request(app)
      .get(`/follows/shop/${shopId}/status`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.following).toBe(false);
  });
});

// ============================================================
// 3. GET /follows/me
// ============================================================

describe("Follows — GET /follows/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/follows/me");
    expect(res.status).toBe(401);
  });

  it("A voit la boutique suivie", async () => {
    const res = await request(app)
      .get("/follows/me")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.follows)).toBe(true);
    expect(res.body.follows.length).toBeGreaterThan(0);

    const shop = res.body.follows.find((f: any) => f.shop_id === shopId);
    expect(shop).toBeDefined();
    expect(shop.shop_name).toBe("Boutique Test Follows");
  });

  it("B n'a aucun follow", async () => {
    const res = await request(app)
      .get("/follows/me")
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.follows.length).toBe(0);
  });

  it("accepte limit + offset", async () => {
    const res = await request(app)
      .get("/follows/me?limit=5&offset=0")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.follows.length).toBeLessThanOrEqual(5);
  });

  it("rejette limit > 100 (400)", async () => {
    const res = await request(app)
      .get("/follows/me?limit=200")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. GET /follows/me/count
// ============================================================

describe("Follows — GET /follows/me/count", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/follows/me/count");
    expect(res.status).toBe(401);
  });

  it("A a au moins 1 follow", async () => {
    const res = await request(app)
      .get("/follows/me/count")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("B a 0 follow", async () => {
    const res = await request(app)
      .get("/follows/me/count")
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

// ============================================================
// 5. GET /follows/shop/:shopId/followers
// ============================================================

describe("Follows — GET /follows/shop/:shopId/followers", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(
      `/follows/shop/${shopId}/followers`
    );
    expect(res.status).toBe(401);
  });

  it("liste les followers de la boutique", async () => {
    const res = await request(app)
      .get(`/follows/shop/${shopId}/followers`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.followers)).toBe(true);
    expect(res.body.followers.length).toBeGreaterThan(0);
  });

  it("rejette un shopId invalide (400)", async () => {
    const res = await request(app)
      .get("/follows/shop/abc/followers")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 6. GET /follows/shop/:shopId/count
// ============================================================

describe("Follows — GET /follows/shop/:shopId/count", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(
      `/follows/shop/${shopId}/count`
    );
    expect(res.status).toBe(401);
  });

  it("retourne le nombre de followers", async () => {
    const res = await request(app)
      .get(`/follows/shop/${shopId}/count`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("retourne 0 pour une boutique sans followers", async () => {
    // Crée un 2ème shop pour vérifier
    const [otherShop] = await db
      .insert(shops)
      .values({
        owner_id: sellerId,
        name: "Autre Boutique Test",
        city: "Lyon",
      })
      .returning();

    const res = await request(app)
      .get(`/follows/shop/${otherShop.id}/count`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);

    // Cleanup
    await db.delete(shops).where(eq(shops.id, otherShop.id));
  });
});
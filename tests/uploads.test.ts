// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Uploads
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
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ✅ MOCK Cloudinary AVANT tout import qui l'utilise
vi.mock("../src/config/cloudinary", () => ({
  cloudinary: {
    uploader: {
      upload_stream: vi.fn((options, callback) => {
        // Simule un upload réussi et retourne une URL fake
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

let userAId: number;
let userBId: number;
let sellerId: number;

let tokenA: string;
let tokenB: string;
let tokenSeller: string;

let shopId: number;
let productId: number;

// Fichier PNG minimal (1x1 pixel transparent)
const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

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
  // Cleanup préalable
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "upltest_a@test.com",
        "upltest_b@test.com",
        "upltest_seller@test.com",
      ])
    );

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);

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

  userAId = await upsertUser({
    email: "upltest_a@test.com",
    username: "upltest_a",
    first_name: "Alice",
    last_name: "Upload",
  });

  userBId = await upsertUser({
    email: "upltest_b@test.com",
    username: "upltest_b",
    first_name: "Bob",
    last_name: "Upload",
  });

  sellerId = await upsertUser({
    email: "upltest_seller@test.com",
    username: "upltest_seller",
    first_name: "Seller",
    last_name: "Upload",
    role: "professionnel",
  });

  tokenA = await login("upltest_a@test.com");
  tokenB = await login("upltest_b@test.com");
  tokenSeller = await login("upltest_seller@test.com");

  // Crée un shop + product pour le seller
  const [shop] = await db
    .insert(shops)
    .values({
      owner_id: sellerId,
      name: "Shop Upload Test",
      city: "Paris",
    })
    .returning();
  shopId = shop.id;

  const [prod] = await db
    .insert(products)
    .values({
      shop_id: shopId,
      name: "Produit Upload Test",
      price: "19.99",
      stock: 10,
    })
    .returning();
  productId = prod.id;
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [userAId, userBId, sellerId];

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
// 1. POST /uploads/avatar
// ============================================================

describe("Uploads — POST /uploads/avatar", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/uploads/avatar")
      .attach("file", PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(401);
  });

  it("rejette sans fichier (400)", async () => {
    const res = await request(app)
      .post("/uploads/avatar")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });

  it("upload un avatar (200)", async () => {
    const res = await request(app)
      .post("/uploads/avatar")
      .set(authHeader(tokenA))
      .attach("file", PNG_BUFFER, "avatar.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain("avatars");
    expect(res.body.message).toBe("Avatar mis à jour");
  });

  it("met à jour avatar_url en DB", async () => {
    const [user] = await db
      .select({ avatar_url: users.avatar_url })
      .from(users)
      .where(eq(users.id, userAId))
      .limit(1);

    expect(user.avatar_url).toContain("avatars");
  });

  it("rejette un MIME type non supporté (400)", async () => {
    const res = await request(app)
      .post("/uploads/avatar")
      .set(authHeader(tokenA))
      .attach("file", Buffer.from("test"), {
        filename: "test.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 2. POST /uploads/cover
// ============================================================

describe("Uploads — POST /uploads/cover", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/uploads/cover")
      .attach("file", PNG_BUFFER, "cover.png");

    expect(res.status).toBe(401);
  });

  it("upload une cover (200)", async () => {
    const res = await request(app)
      .post("/uploads/cover")
      .set(authHeader(tokenA))
      .attach("file", PNG_BUFFER, "cover.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain("covers");
  });

  it("met à jour cover_url en DB", async () => {
    const [user] = await db
      .select({ cover_url: users.cover_url })
      .from(users)
      .where(eq(users.id, userAId))
      .limit(1);

    expect(user.cover_url).toContain("covers");
  });
});

// ============================================================
// 3. POST /uploads/shop-logo
// ============================================================

describe("Uploads — POST /uploads/shop-logo", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/uploads/shop-logo")
      .field("shop_id", String(shopId))
      .attach("file", PNG_BUFFER, "logo.png");

    expect(res.status).toBe(401);
  });

  it("rejette si shop_id manquant (400)", async () => {
    const res = await request(app)
      .post("/uploads/shop-logo")
      .set(authHeader(tokenSeller))
      .attach("file", PNG_BUFFER, "logo.png");

    expect(res.status).toBe(400);
  });

  it("rejette si pas le propriétaire (403)", async () => {
    const res = await request(app)
      .post("/uploads/shop-logo")
      .set(authHeader(tokenA))
      .field("shop_id", String(shopId))
      .attach("file", PNG_BUFFER, "logo.png");

    expect(res.status).toBe(403);
  });

  it("rejette une boutique inexistante (404)", async () => {
    const res = await request(app)
      .post("/uploads/shop-logo")
      .set(authHeader(tokenSeller))
      .field("shop_id", "999999")
      .attach("file", PNG_BUFFER, "logo.png");

    expect(res.status).toBe(404);
  });

  it("upload le logo (200)", async () => {
    const res = await request(app)
      .post("/uploads/shop-logo")
      .set(authHeader(tokenSeller))
      .field("shop_id", String(shopId))
      .attach("file", PNG_BUFFER, "logo.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain("shops");
  });

  it("met à jour logo_url en DB", async () => {
    const [shop] = await db
      .select({ logo_url: shops.logo_url })
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    expect(shop.logo_url).toContain("shops");
  });
});

// ============================================================
// 4. POST /uploads/product
// ============================================================

describe("Uploads — POST /uploads/product", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/uploads/product")
      .field("product_id", String(productId))
      .attach("file", PNG_BUFFER, "product.png");

    expect(res.status).toBe(401);
  });

  it("rejette si product_id manquant (400)", async () => {
    const res = await request(app)
      .post("/uploads/product")
      .set(authHeader(tokenSeller))
      .attach("file", PNG_BUFFER, "product.png");

    expect(res.status).toBe(400);
  });

  it("rejette si pas le propriétaire du shop parent (403)", async () => {
    const res = await request(app)
      .post("/uploads/product")
      .set(authHeader(tokenA))
      .field("product_id", String(productId))
      .attach("file", PNG_BUFFER, "product.png");

    expect(res.status).toBe(403);
  });

  it("rejette un produit inexistant (404)", async () => {
    const res = await request(app)
      .post("/uploads/product")
      .set(authHeader(tokenSeller))
      .field("product_id", "999999")
      .attach("file", PNG_BUFFER, "product.png");

    expect(res.status).toBe(404);
  });

  it("upload l'image produit (200)", async () => {
    const res = await request(app)
      .post("/uploads/product")
      .set(authHeader(tokenSeller))
      .field("product_id", String(productId))
      .attach("file", PNG_BUFFER, "product.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain("products");
  });

  it("met à jour image_url en DB", async () => {
    const [product] = await db
      .select({ image_url: products.image_url })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    expect(product.image_url).toContain("products");
  });
});

// ============================================================
// 5. POST /uploads/post-media
// ============================================================

describe("Uploads — POST /uploads/post-media", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/uploads/post-media")
      .attach("file", PNG_BUFFER, "media.png");

    expect(res.status).toBe(401);
  });

  it("rejette sans fichier (400)", async () => {
    const res = await request(app)
      .post("/uploads/post-media")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });

  it("upload un média pour post (200)", async () => {
    const res = await request(app)
      .post("/uploads/post-media")
      .set(authHeader(tokenA))
      .attach("file", PNG_BUFFER, "media.png");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain("posts");
  });

  it("retourne juste l'URL (pas de modif en DB)", async () => {
    const res = await request(app)
      .post("/uploads/post-media")
      .set(authHeader(tokenB))
      .attach("file", PNG_BUFFER, "media2.png");

    expect(res.status).toBe(200);
    expect(res.body.url).toContain("posts");
    // Le user n'a PAS été modifié (post-media ne touche pas la DB user)
    const [user] = await db
      .select({
        avatar_url: users.avatar_url,
        cover_url: users.cover_url,
      })
      .from(users)
      .where(eq(users.id, userBId))
      .limit(1);

    expect(user.avatar_url).toBe(null);
    expect(user.cover_url).toBe(null);
  });
});
// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Share
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  posts,
  shops,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let sellerId: number;
let userId: number;

let postId: number;
let postWithoutMediaId: number;
let shopId: number;

const USERNAME = "sharetest_user";

// ============================================================
// HELPERS
// ============================================================

async function upsertUser(opts: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role?: "particulier" | "professionnel";
  bio?: string;
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
        bio: opts.bio ?? null,
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
        bio: opts.bio ?? null,
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

// ============================================================
// BEFORE ALL — Setup
// ============================================================

beforeAll(async () => {
  sellerId = await upsertUser({
    email: "sharetest_seller@test.com",
    username: "sharetest_seller",
    first_name: "Seller",
    last_name: "Share",
    role: "professionnel",
  });

  userId = await upsertUser({
    email: "sharetest_user@test.com",
    username: USERNAME,
    first_name: "Alice",
    last_name: "Share",
    bio: "Bio de test pour le partage",
  });

  // Crée un post avec média
  const [existingPost] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.author_id, userId))
    .limit(1);

  if (existingPost) {
    postId = existingPost.id;
  } else {
    const [created] = await db
      .insert(posts)
      .values({
        author_id: userId,
        content: "Mon super post à partager",
        media_urls: JSON.stringify(["https://example.com/image.jpg"]),
        visibility: "public",
      })
      .returning();

    postId = created.id;
  }

  // Crée un post sans média
  const [postNoMedia] = await db
    .insert(posts)
    .values({
      author_id: userId,
      content: "Post sans média",
      visibility: "public",
    })
    .returning();

  postWithoutMediaId = postNoMedia.id;

  // Crée un shop
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
        name: "Boutique Test Share",
        description: "Boutique pour tester le partage",
        city: "Paris",
      })
      .returning();

    shopId = created.id;
  }
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [sellerId, userId];

    await db.delete(posts).where(inArray(posts.author_id, userIds));
    await db.delete(shops).where(inArray(shops.owner_id, userIds));

    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));

    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /share/posts/:id/og
// ============================================================

describe("Share — GET /share/posts/:id/og", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(`/share/posts/${postId}/og`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.og).toHaveProperty("url");
    expect(res.body.og).toHaveProperty("title");
    expect(res.body.og).toHaveProperty("description");
    expect(res.body.og).toHaveProperty("image");
  });

  it("contient le username de l'auteur dans le titre", async () => {
    const res = await request(app).get(`/share/posts/${postId}/og`);

    expect(res.body.og.title).toContain(USERNAME);
  });

  it("utilise le premier média comme image", async () => {
    const res = await request(app).get(`/share/posts/${postId}/og`);

    expect(res.body.og.image).toBe("https://example.com/image.jpg");
  });

  it("utilise l'image par défaut si pas de média", async () => {
    const res = await request(app).get(
      `/share/posts/${postWithoutMediaId}/og`
    );

    expect(res.status).toBe(200);
    expect(res.body.og.image).toContain("og-default.jpg");
  });

  it("contient les stats (likes, comments, shares)", async () => {
    const res = await request(app).get(`/share/posts/${postId}/og`);

    expect(res.body.og.stats).toHaveProperty("likes");
    expect(res.body.og.stats).toHaveProperty("comments");
    expect(res.body.og.stats).toHaveProperty("shares");
  });

  it("retourne 404 pour un post inexistant", async () => {
    const res = await request(app).get("/share/posts/999999/og");
    expect(res.status).toBe(404);
  });

  it("rejette un id invalide (400)", async () => {
    const res = await request(app).get("/share/posts/abc/og");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 2. GET /share/users/:username/og
// ============================================================

describe("Share — GET /share/users/:username/og", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(
      `/share/users/${USERNAME}/og`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.og).toHaveProperty("url");
    expect(res.body.og).toHaveProperty("title");
  });

  it("contient le username dans l'URL et le titre", async () => {
    const res = await request(app).get(
      `/share/users/${USERNAME}/og`
    );

    expect(res.body.og.url).toContain(`/u/${USERNAME}`);
    expect(res.body.og.title).toContain(USERNAME);
  });

  it("utilise la bio comme description", async () => {
    const res = await request(app).get(
      `/share/users/${USERNAME}/og`
    );

    expect(res.body.og.description).toBe("Bio de test pour le partage");
  });

  it("retourne 404 pour un username inexistant", async () => {
    const res = await request(app).get("/share/users/nonexistent_xyz/og");
    expect(res.status).toBe(404);
  });
});

// ============================================================
// 3. GET /share/shops/:id/og
// ============================================================

describe("Share — GET /share/shops/:id/og", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(`/share/shops/${shopId}/og`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.og).toHaveProperty("url");
    expect(res.body.og).toHaveProperty("title");
    expect(res.body.og).toHaveProperty("description");
  });

  it("contient le nom de la boutique dans le titre", async () => {
    const res = await request(app).get(`/share/shops/${shopId}/og`);

    expect(res.body.og.title).toContain("Boutique Test Share");
  });

  it("retourne 404 pour un shop inexistant", async () => {
    const res = await request(app).get("/share/shops/999999/og");
    expect(res.status).toBe(404);
  });

  it("rejette un id invalide (400)", async () => {
    const res = await request(app).get("/share/shops/abc/og");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. GET /share/posts/:id/links
// ============================================================

describe("Share — GET /share/posts/:id/links", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(
      `/share/posts/${postId}/links`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("og");
    expect(res.body).toHaveProperty("links");
  });

  it("retourne les liens des plateformes web (strings)", async () => {
    const res = await request(app).get(
      `/share/posts/${postId}/links`
    );

    expect(typeof res.body.links.whatsapp).toBe("string");
    expect(typeof res.body.links.telegram).toBe("string");
    expect(typeof res.body.links.twitter).toBe("string");
    expect(typeof res.body.links.facebook).toBe("string");
    expect(typeof res.body.links.linkedin).toBe("string");
    expect(typeof res.body.links.sms).toBe("string");
    expect(typeof res.body.links.email).toBe("string");
  });

  it("retourne les deep links pour Instagram / TikTok", async () => {
    const res = await request(app).get(
      `/share/posts/${postId}/links`
    );

    expect(res.body.links.instagram).toHaveProperty("type");
    expect(res.body.links.instagram.type).toBe("app_deep_link");
    expect(res.body.links.instagram).toHaveProperty("deep_link");
    expect(res.body.links.instagram).toHaveProperty("url_to_copy");
    expect(res.body.links.instagram).toHaveProperty("text_to_copy");

    expect(res.body.links.tiktok.type).toBe("app_deep_link");
  });

  it("retourne copy_link avec url et text", async () => {
    const res = await request(app).get(
      `/share/posts/${postId}/links`
    );

    expect(res.body.links.copy_link).toHaveProperty("url");
    expect(res.body.links.copy_link).toHaveProperty("text");
  });

  it("le lien WhatsApp contient l'URL encodée", async () => {
    const res = await request(app).get(
      `/share/posts/${postId}/links`
    );

    expect(res.body.links.whatsapp).toContain("wa.me");
    expect(res.body.links.whatsapp).toContain("https%3A%2F%2F");
  });

  it("retourne 404 pour un post inexistant", async () => {
    const res = await request(app).get("/share/posts/999999/links");
    expect(res.status).toBe(404);
  });
});

// ============================================================
// 5. GET /share/users/:username/links
// ============================================================

describe("Share — GET /share/users/:username/links", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(
      `/share/users/${USERNAME}/links`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("og");
    expect(res.body).toHaveProperty("links");
  });

  it("contient tous les liens de partage", async () => {
    const res = await request(app).get(
      `/share/users/${USERNAME}/links`
    );

    expect(res.body.links).toHaveProperty("whatsapp");
    expect(res.body.links).toHaveProperty("instagram");
    expect(res.body.links).toHaveProperty("copy_link");
  });

  it("retourne 404 pour un username inexistant", async () => {
    const res = await request(app).get(
      "/share/users/nonexistent_xyz/links"
    );

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 6. GET /share/shops/:id/links
// ============================================================

describe("Share — GET /share/shops/:id/links", () => {
  it("retourne 200 sans auth (public)", async () => {
    const res = await request(app).get(
      `/share/shops/${shopId}/links`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("og");
    expect(res.body).toHaveProperty("links");
  });

  it("retourne tous les liens de partage", async () => {
    const res = await request(app).get(
      `/share/shops/${shopId}/links`
    );

    expect(res.body.links).toHaveProperty("whatsapp");
    expect(res.body.links).toHaveProperty("telegram");
    expect(res.body.links).toHaveProperty("instagram");
    expect(res.body.links).toHaveProperty("tiktok");
    expect(res.body.links).toHaveProperty("copy_link");
  });

  it("retourne 404 pour un shop inexistant", async () => {
    const res = await request(app).get("/share/shops/999999/links");
    expect(res.status).toBe(404);
  });
});
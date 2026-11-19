// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Users
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  posts,
  postLikes,
  postComments,
  friendships,
  reviews,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let userAId: number;
let userBId: number;
let userCId: number;

let tokenA: string;
let tokenB: string;

// ============================================================
// HELPERS
// ============================================================

async function upsertUser(opts: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role?: "particulier" | "professionnel";
  is_private?: number;
  city?: string;
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
        is_private: opts.is_private ?? 0,
        city: opts.city ?? null,
        bio: opts.bio ?? null,
        first_name: opts.first_name,
        last_name: opts.last_name,
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
        is_private: opts.is_private ?? 0,
        city: opts.city ?? null,
        bio: opts.bio ?? null,
      })
      .returning();

    userId = created.id;
  }

  await db
    .insert(userSettings)
    .values({
      user_id: userId,
      search_indexable: 1,
    })
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
  userAId = await upsertUser({
    email: "usertest_a@test.com",
    username: "usertest_a",
    first_name: "Alice",
    last_name: "User",
    role: "particulier",
    city: "Paris",
    bio: "Bio initiale",
  });

  userBId = await upsertUser({
    email: "usertest_b@test.com",
    username: "usertest_b",
    first_name: "Bob",
    last_name: "User",
    role: "professionnel",
    city: "Lyon",
  });

  userCId = await upsertUser({
    email: "usertest_c@test.com",
    username: "usertest_c",
    first_name: "Carol",
    last_name: "User",
    role: "particulier",
    is_private: 1,
  });

  tokenA = await login("usertest_a@test.com");
  tokenB = await login("usertest_b@test.com");
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [userAId, userBId, userCId];

    // Supprime likes / commentaires des posts de test
    const myPosts = await db
      .select({ id: posts.id })
      .from(posts)
      .where(inArray(posts.author_id, userIds));

    const postIds = myPosts.map((p) => p.id);

    if (postIds.length > 0) {
      await db.delete(postLikes).where(inArray(postLikes.post_id, postIds));
      await db
        .delete(postComments)
        .where(inArray(postComments.post_id, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }

    // Supprime les friendships
    const fships = await db
      .select({ id: friendships.id })
      .from(friendships);

    // (on supprime celles qui concernent nos users)
    await db
      .delete(friendships)
      .where(inArray(friendships.requester_id, userIds));
    await db
      .delete(friendships)
      .where(inArray(friendships.receiver_id, userIds));

    // Supprime les reviews
    await db.delete(reviews).where(inArray(reviews.author_id, userIds));
    await db.delete(reviews).where(inArray(reviews.seller_id, userIds));

    // Supprime les settings + users
    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));

    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /users/me
// ============================================================

describe("Users — GET /users/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/users/me");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec token", async () => {
    const res = await request(app).get("/users/me").set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(userAId);
    expect(res.body.user.username).toBe("usertest_a");
  });

  it("ne retourne JAMAIS password_hash", async () => {
    const res = await request(app).get("/users/me").set(authHeader(tokenA));

    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("retourne les champs attendus", async () => {
    const res = await request(app).get("/users/me").set(authHeader(tokenA));

    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user).toHaveProperty("first_name");
    expect(res.body.user).toHaveProperty("last_name");
    expect(res.body.user).toHaveProperty("username");
    expect(res.body.user).toHaveProperty("email");
    expect(res.body.user).toHaveProperty("role");
    expect(res.body.user).toHaveProperty("is_private");
    expect(res.body.user).toHaveProperty("created_at");
  });
});

// ============================================================
// 2. PUT /users/me
// ============================================================

describe("Users — PUT /users/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/users/me")
      .send({ first_name: "Hacked" });

    expect(res.status).toBe(401);
  });

  it("met à jour le first_name (200)", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({ first_name: "Alicia" });

    expect(res.status).toBe(200);
    expect(res.body.user.first_name).toBe("Alicia");
  });

  it("met à jour la bio", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({ bio: "Nouvelle bio de test" });

    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe("Nouvelle bio de test");
  });

  it("met à jour la ville", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({ city: "Marseille" });

    expect(res.status).toBe(200);
    expect(res.body.user.city).toBe("Marseille");
  });

  it("rejette email déjà utilisé (400)", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({ email: "usertest_b@test.com" });

    expect(res.status).toBe(400);
  });

  it("rejette username déjà utilisé (400)", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({ username: "usertest_b" });

    expect(res.status).toBe(400);
  });

  it("rejette username invalide (400)", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({ username: "AB" }); // trop court

    expect(res.status).toBe(400);
  });

  it("rejette website invalide (400)", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({ website: "not-a-url" });

    expect(res.status).toBe(400);
  });

  it("rejette body vide (400)", async () => {
    const res = await request(app)
      .put("/users/me")
      .set(authHeader(tokenA))
      .send({});

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 3. PUT /users/me/privacy
// ============================================================

describe("Users — PUT /users/me/privacy", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/users/me/privacy")
      .send({ is_private: true });

    expect(res.status).toBe(401);
  });

  it("met le profil en privé (200)", async () => {
    const res = await request(app)
      .put("/users/me/privacy")
      .set(authHeader(tokenA))
      .send({ is_private: true });

    expect(res.status).toBe(200);
    expect(res.body.user.is_private).toBe(1);
  });

  it("remet le profil en public (200)", async () => {
    const res = await request(app)
      .put("/users/me/privacy")
      .set(authHeader(tokenA))
      .send({ is_private: false });

    expect(res.status).toBe(200);
    expect(res.body.user.is_private).toBe(0);
  });

  it("rejette is_private non booléen (400)", async () => {
    const res = await request(app)
      .put("/users/me/privacy")
      .set(authHeader(tokenA))
      .send({ is_private: "yes" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. GET /users
// ============================================================

describe("Users — GET /users", () => {
  it("retourne 200 sans token (public)", async () => {
    const res = await request(app).get("/users");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it("accepte search", async () => {
    const res = await request(app).get("/users?search=Alice");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("accepte limit + offset", async () => {
    const res = await request(app).get("/users?limit=2&offset=0");

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(2);
  });

  it("rejette limit > 100 (400)", async () => {
    const res = await request(app).get("/users?limit=200");
    expect(res.status).toBe(400);
  });

  it("rejette offset négatif (400)", async () => {
    const res = await request(app).get("/users?offset=-1");
    expect(res.status).toBe(400);
  });

  it("ne retourne jamais password_hash", async () => {
    const res = await request(app).get("/users");

    if (res.body.users.length > 0) {
      expect(res.body.users[0]).not.toHaveProperty("password_hash");
    }
  });
});

// ============================================================
// 5. GET /users/u/:username
// ============================================================

describe("Users — GET /users/u/:username", () => {
  it("retourne 200 pour un user existant", async () => {
    const res = await request(app).get("/users/u/usertest_a");

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("usertest_a");
  });

  it("retourne 404 pour un username inexistant", async () => {
    const res = await request(app).get("/users/u/nonexistent_username_xyz");
    expect(res.status).toBe(404);
  });

  it("ne retourne jamais password_hash", async () => {
    const res = await request(app).get("/users/u/usertest_a");
    expect(res.body.user).not.toHaveProperty("password_hash");
  });
});

// ============================================================
// 6. GET /users/:id
// ============================================================

describe("Users — GET /users/:id", () => {
  it("retourne 200 pour un id valide", async () => {
    const res = await request(app).get(`/users/${userAId}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userAId);
  });

  it("retourne 404 pour un id inexistant", async () => {
    const res = await request(app).get("/users/999999");
    expect(res.status).toBe(404);
  });

  it("rejette un id non numérique (400)", async () => {
    const res = await request(app).get("/users/abc");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 7. GET /users/:id/stats
// ============================================================

describe("Users — GET /users/:id/stats", () => {
  it("retourne 200 avec les stats d'un user existant", async () => {
    const res = await request(app).get(`/users/${userAId}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toHaveProperty("posts_count");
    expect(res.body.stats).toHaveProperty("friends_count");
    expect(res.body.stats).toHaveProperty("reviews_count");
    expect(res.body.stats).toHaveProperty("average_rating");
  });

  it("retourne 404 pour un id inexistant", async () => {
    const res = await request(app).get("/users/999999/stats");
    expect(res.status).toBe(404);
  });

  it("retourne 400 pour un id non numérique", async () => {
    const res = await request(app).get("/users/abc/stats");
    expect(res.status).toBe(400);
  });

  it("retourne des stats à zéro pour un user sans activité", async () => {
    const res = await request(app).get(`/users/${userCId}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.stats.posts_count).toBe(0);
    expect(res.body.stats.friends_count).toBe(0);
    expect(res.body.stats.reviews_count).toBe(0);
  });
});

// ============================================================
// 8. GET /users/:id/friends
// ============================================================

describe("Users — GET /users/:id/friends", () => {
  it("retourne 200 pour un profil public (même sans token)", async () => {
    const res = await request(app).get(`/users/${userAId}/friends`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.friends)).toBe(true);
  });

  it("rejette 403 pour un profil privé consulté par un autre", async () => {
    // userC a is_private = 1
    const res = await request(app)
      .get(`/users/${userCId}/friends`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(403);
  });

  it("autorise 200 pour son propre profil privé", async () => {
    // Login userC pour obtenir son token
    const tokenC = await login("usertest_c@test.com");

    const res = await request(app)
      .get(`/users/${userCId}/friends`)
      .set(authHeader(tokenC));

    expect(res.status).toBe(200);
  });

  it("retourne 404 pour un id inexistant", async () => {
    const res = await request(app).get("/users/999999/friends");
    expect(res.status).toBe(404);
  });

  it("retourne 400 pour un id non numérique", async () => {
    const res = await request(app).get("/users/abc/friends");
    expect(res.status).toBe(400);
  });
});
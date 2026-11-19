// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Blocks
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { db } from "../../src/core/db";
import {
  users,
  userSettings,
  posts,
  userBlocks,
} from "../../src/core/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let userAId: number;
let userBId: number;
let adminId: number;

let tokenA: string;
let tokenB: string;
let tokenAdmin: string;

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

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, opts.email))
    .limit(1);

  let userId: number;

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
// BEFORE EACH
// ============================================================

beforeEach(async () => {
  // Nettoyer les tables pour éviter la pollution entre tests
  await db.delete(userBlocks);
  await db.delete(posts);

  userAId = await upsertUser({
    email: "blockstest_a@test.com",
    username: "blockstest_a",
    first_name: "Alice",
    last_name: "Blocks",
  });
  userBId = await upsertUser({
    email: "blockstest_b@test.com",
    username: "blockstest_b",
    first_name: "Bob",
    last_name: "Blocks",
  });
  adminId = await upsertUser({
    email: "blockstest_admin@test.com",
    username: "blockstest_admin",
    first_name: "Admin",
    last_name: "Blocks",
    role: "admin",
  });

  tokenA = await login("blockstest_a@test.com");
  tokenB = await login("blockstest_b@test.com");
  tokenAdmin = await login("blockstest_admin@test.com");
});

// ============================================================
// TESTS
// ============================================================

describe("Blocks — Blocage / Restriction utilisateurs", () => {
  // ============================================================
  // POST /users/:id/block
  // ============================================================

  describe("POST /users/:id/block", () => {
    it("bloque un utilisateur (200)", async () => {
      const res = await request(app)
        .post(`/users/${userBId}/block`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.type).toBe("block");
    });

    it("rejette le blocage de soi-même (400)", async () => {
      const res = await request(app)
        .post(`/users/${userAId}/block`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(400);
    });

    it("rejette un doublon (409)", async () => {
      await request(app).post(`/users/${userBId}/block`).set(authHeader(tokenA));
      const res = await request(app)
        .post(`/users/${userBId}/block`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(409);
    });

    it("rejette un user inexistant (404)", async () => {
      const res = await request(app)
        .post("/users/999999/block")
        .set(authHeader(tokenA));
      expect(res.status).toBe(404);
    });

    it("rejette le blocage d'un admin (403)", async () => {
      const res = await request(app)
        .post(`/users/${adminId}/block`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/administrateur/i);
    });

    it("rejette sans auth (401)", async () => {
      const res = await request(app).post(`/users/${userBId}/block`);
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // DELETE /users/:id/block
  // ============================================================

  describe("DELETE /users/:id/block", () => {
    it("débloque un utilisateur (200)", async () => {
      await request(app).post(`/users/${userBId}/block`).set(authHeader(tokenA));
      const res = await request(app)
        .delete(`/users/${userBId}/block`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejette si pas bloqué (404)", async () => {
      const res = await request(app)
        .delete(`/users/${userBId}/block`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // RESTRICT
  // ============================================================

  describe("POST /users/:id/restrict", () => {
    it("restreint un utilisateur (200)", async () => {
      const res = await request(app)
        .post(`/users/${userBId}/restrict`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.type).toBe("restrict");
    });

    it("rejette la restriction d'un admin (403)", async () => {
      const res = await request(app)
        .post(`/users/${adminId}/restrict`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(403);
    });

    it("rejette un doublon (409)", async () => {
      await request(app).post(`/users/${userBId}/restrict`).set(authHeader(tokenA));
      const res = await request(app)
        .post(`/users/${userBId}/restrict`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /users/:id/restrict", () => {
    it("retire la restriction (200)", async () => {
      await request(app).post(`/users/${userBId}/restrict`).set(authHeader(tokenA));
      const res = await request(app)
        .delete(`/users/${userBId}/restrict`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // LISTES
  // ============================================================

  describe("GET /users/me/blocked et /restricted", () => {
    it("liste les bloqués (200)", async () => {
      await request(app).post(`/users/${userBId}/block`).set(authHeader(tokenA));
      const res = await request(app)
        .get("/users/me/blocked")
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.blocked[0].user_id).toBe(userBId);
    });

    it("liste les restreints (200)", async () => {
      await request(app).post(`/users/${userBId}/restrict`).set(authHeader(tokenA));
      const res = await request(app)
        .get("/users/me/restricted")
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });

    it("liste vide si rien (200)", async () => {
      const res = await request(app)
        .get("/users/me/blocked")
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  // ============================================================
  // STATUS
  // ============================================================

  describe("GET /users/:id/block-status", () => {
    it("retourne le statut bloqué", async () => {
      await request(app).post(`/users/${userBId}/block`).set(authHeader(tokenA));
      const res = await request(app)
        .get(`/users/${userBId}/block-status`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.is_blocked).toBe(true);
      expect(res.body.is_restricted).toBe(false);
    });

    it("retourne false si rien", async () => {
      const res = await request(app)
        .get(`/users/${userBId}/block-status`)
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      expect(res.body.is_blocked).toBe(false);
    });
  });

  // ============================================================
  // FILTRAGE FEED
  // ============================================================

  describe("Filtrage feed", () => {
    it("ne montre plus les posts d'un user bloqué", async () => {
      // A bloque B
      await request(app).post(`/users/${userBId}/block`).set(authHeader(tokenA));

      // B publie un post
      await db.insert(posts).values({
        author_id: userBId,
        content: "Post de Bob",
        visibility: "public",
      });

      // A regarde le feed
      const res = await request(app)
        .get("/posts/feed")
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      const hasB = res.body.posts.some((p: any) => p.author_id === userBId);
      expect(hasB).toBe(false);
    });

    it("ne montre plus les posts si on est bloqué par l'auteur", async () => {
      // B bloque A
      await request(app).post(`/users/${userAId}/block`).set(authHeader(tokenB));

      // B publie un post
      await db.insert(posts).values({
        author_id: userBId,
        content: "Post de Bob",
        visibility: "public",
      });

      // A regarde le feed
      const res = await request(app)
        .get("/posts/feed")
        .set(authHeader(tokenA));
      expect(res.status).toBe(200);
      const hasB = res.body.posts.some((p: any) => p.author_id === userBId);
      expect(hasB).toBe(false);
    });
  });

  // ============================================================
  // EFFETS CROISÉS
  // ============================================================

  describe("Effets croisés", () => {
    it("bloquer supprime une restriction existante", async () => {
      await request(app).post(`/users/${userBId}/restrict`).set(authHeader(tokenA));
      await request(app).post(`/users/${userBId}/block`).set(authHeader(tokenA));

      const status = await request(app)
        .get(`/users/${userBId}/block-status`)
        .set(authHeader(tokenA));
      expect(status.body.is_blocked).toBe(true);
      expect(status.body.is_restricted).toBe(false);
    });

    it("impossible de commenter le post d'un user bloqué (403)", async () => {
      const [post] = await db
        .insert(posts)
        .values({ author_id: userBId, content: "Post B", visibility: "public" })
        .returning();

      await request(app).post(`/users/${userBId}/block`).set(authHeader(tokenA));

      const res = await request(app)
        .post(`/posts/${post.id}/comments`)
        .set(authHeader(tokenA))
        .send({ content: "Hello" });
      expect(res.status).toBe(403);
    });
  });
});
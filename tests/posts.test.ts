// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Posts
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
  postShares,
  friendships,
  notifications,
} from "../src/core/db/schema";
import { eq, inArray, or, and } from "drizzle-orm";
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
let tokenC: string;

// ============================================================
// HELPERS
// ============================================================

async function upsertUser(opts: {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
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
        role: "particulier",
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
  userAId = await upsertUser({
    email: "posttest_a@test.com",
    username: "posttest_a",
    first_name: "Alice",
    last_name: "Post",
  });

  userBId = await upsertUser({
    email: "posttest_b@test.com",
    username: "posttest_b",
    first_name: "Bob",
    last_name: "Post",
  });

  userCId = await upsertUser({
    email: "posttest_c@test.com",
    username: "posttest_c",
    first_name: "Carol",
    last_name: "Post",
  });

  tokenA = await login("posttest_a@test.com");
  tokenB = await login("posttest_b@test.com");
  tokenC = await login("posttest_c@test.com");
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [userAId, userBId, userCId];

    // Récupère tous les posts des users de test (y compris partagés)
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
      await db.delete(postShares).where(inArray(postShares.post_id, postIds));

      // Nettoie aussi les posts dont shared_from_post_id pointe sur nos posts
      await db
        .delete(posts)
        .where(inArray(posts.shared_from_post_id, postIds));

      await db.delete(posts).where(inArray(posts.id, postIds));
    }

    // Nettoyer les partages dont l'auteur est un user de test
    await db.delete(postShares).where(inArray(postShares.user_id, userIds));

    // Nettoyer les likes / commentaires résiduels
    await db.delete(postLikes).where(inArray(postLikes.user_id, userIds));
    await db.delete(postComments).where(inArray(postComments.author_id, userIds));

    // Nettoyer les friendships
    await db
      .delete(friendships)
      .where(inArray(friendships.requester_id, userIds));
    await db
      .delete(friendships)
      .where(inArray(friendships.receiver_id, userIds));

    // Nettoyer les notifs
    await db
      .delete(notifications)
      .where(inArray(notifications.user_id, userIds));

    // Nettoyer les users
    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. POST /posts — Création
// ============================================================

describe("Posts — POST /posts", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/posts")
      .send({ content: "Hello" });

    expect(res.status).toBe(401);
  });

  it("crée un post avec du texte (201)", async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Mon premier post de test" });

    expect(res.status).toBe(201);
    expect(res.body.post).toHaveProperty("id");
    expect(res.body.post.content).toBe("Mon premier post de test");
    expect(res.body.post.author.id).toBe(userAId);
  });

  it("crée un post avec média (201)", async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ media_urls: ["https://example.com/image.jpg"] });

    expect(res.status).toBe(201);
    expect(res.body.post.media_urls).toHaveLength(1);
  });

  it("rejette un post vide (400)", async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "" });

    expect(res.status).toBe(400);
  });

  it("rejette un content > 5000 caractères (400)", async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "a".repeat(5001) });

    expect(res.status).toBe(400);
  });

  it("rejette plus de 4 médias (400)", async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({
        media_urls: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
          "https://example.com/4.jpg",
          "https://example.com/5.jpg",
        ],
      });

    expect(res.status).toBe(400);
  });

  it("rejette visibilité invalide (400)", async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Test", visibility: "invalid" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 2. GET /posts/:id
// ============================================================

describe("Posts — GET /posts/:id", () => {
  let publicPostId: number;
  let privatePostId: number;

  beforeAll(async () => {
    const res1 = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Post public", visibility: "public" });
    publicPostId = res1.body.post.id;

    const res2 = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Post privé", visibility: "private" });
    privatePostId = res2.body.post.id;
  });

  it("retourne un post public sans token (200)", async () => {
    const res = await request(app).get(`/posts/${publicPostId}`);

    expect(res.status).toBe(200);
    expect(res.body.post.id).toBe(publicPostId);
    expect(res.body.post).toHaveProperty("author");
    expect(res.body.post).toHaveProperty("liked_by_me");
  });

  it("retourne un post privé à son auteur (200)", async () => {
    const res = await request(app)
      .get(`/posts/${privatePostId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.post.id).toBe(privatePostId);
  });

  it("rejette un post privé pour un autre (403)", async () => {
    const res = await request(app)
      .get(`/posts/${privatePostId}`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(403);
  });

  it("retourne 404 pour un post inexistant", async () => {
    const res = await request(app).get("/posts/999999");
    expect(res.status).toBe(404);
  });

  it("rejette un id invalide (400)", async () => {
    const res = await request(app).get("/posts/abc");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 3. GET /posts/feed
// ============================================================

describe("Posts — GET /posts/feed", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/posts/feed");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec token", async () => {
    const res = await request(app)
      .get("/posts/feed")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.posts)).toBe(true);
  });

  it("accepte limit + offset", async () => {
    const res = await request(app)
      .get("/posts/feed?limit=5&offset=0")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBeLessThanOrEqual(5);
  });

  it("rejette limit > 50 (400)", async () => {
    const res = await request(app)
      .get("/posts/feed?limit=100")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. GET /posts/me
// ============================================================

describe("Posts — GET /posts/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/posts/me");
    expect(res.status).toBe(401);
  });

  it("retourne mes posts (200)", async () => {
    const res = await request(app).get("/posts/me").set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.posts)).toBe(true);

    // Tous les posts doivent m'appartenir
    for (const post of res.body.posts) {
      expect(post.author.id).toBe(userAId);
    }
  });
});

// ============================================================
// 5. PATCH /posts/:id
// ============================================================

describe("Posts — PATCH /posts/:id", () => {
  let postId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "À modifier" });
    postId = res.body.post.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .patch(`/posts/${postId}`)
      .send({ content: "Test" });

    expect(res.status).toBe(401);
  });

  it("l'auteur peut modifier (200)", async () => {
    const res = await request(app)
      .patch(`/posts/${postId}`)
      .set(authHeader(tokenA))
      .send({ content: "Modifié" });

    expect(res.status).toBe(200);
    expect(res.body.post.content).toBe("Modifié");
  });

  it("un autre user ne peut pas modifier (403)", async () => {
    const res = await request(app)
      .patch(`/posts/${postId}`)
      .set(authHeader(tokenB))
      .send({ content: "Hack" });

    expect(res.status).toBe(403);
  });

  it("rejette 404 pour un post inexistant", async () => {
    const res = await request(app)
      .patch("/posts/999999")
      .set(authHeader(tokenA))
      .send({ content: "Test" });

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 6. DELETE /posts/:id
// ============================================================

describe("Posts — DELETE /posts/:id", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).delete("/posts/1");
    expect(res.status).toBe(401);
  });

  it("l'auteur peut supprimer (204)", async () => {
    const createRes = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "À supprimer" });

    const id = createRes.body.post.id;

    const res = await request(app)
      .delete(`/posts/${id}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(204);
  });

  it("un autre user ne peut pas supprimer (403)", async () => {
    const createRes = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Protégé" });

    const id = createRes.body.post.id;

    const res = await request(app)
      .delete(`/posts/${id}`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 7. Likes
// ============================================================

describe("Posts — Likes", () => {
  let postId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Post à liker" });
    postId = res.body.post.id;
  });

  it("rejette like sans token (401)", async () => {
    const res = await request(app).post(`/posts/${postId}/like`);
    expect(res.status).toBe(401);
  });

  it("like un post (200)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/like`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(true);
  });

  it("unlike un post déjà liké (200)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/like`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(false);
  });

  it("retourne la liste des likes (200)", async () => {
    // Re-like pour avoir au moins 1
    await request(app)
      .post(`/posts/${postId}/like`)
      .set(authHeader(tokenB));

    const res = await request(app).get(`/posts/${postId}/likes`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.likes)).toBe(true);
  });

  it("rejette like sur post inexistant (404)", async () => {
    const res = await request(app)
      .post("/posts/999999/like")
      .set(authHeader(tokenA));

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 8. Commentaires
// ============================================================

describe("Posts — Commentaires", () => {
  let postId: number;
  let commentId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Post à commenter" });
    postId = res.body.post.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/comments`)
      .send({ content: "Test" });

    expect(res.status).toBe(401);
  });

  it("ajoute un commentaire (201)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/comments`)
      .set(authHeader(tokenB))
      .send({ content: "Super post !" });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe("Super post !");
    commentId = res.body.comment.id;
  });

  it("rejette un commentaire vide (400)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/comments`)
      .set(authHeader(tokenB))
      .send({ content: "" });

    expect(res.status).toBe(400);
  });

  it("ajoute une réponse (201)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/comments`)
      .set(authHeader(tokenC))
      .send({ content: "Réponse", parent_comment_id: commentId });

    expect(res.status).toBe(201);
    expect(res.body.comment.parent_comment_id).toBe(commentId);
  });

  it("rejette une réponse à une réponse (400)", async () => {
    // Récupère la réponse
    const listRes = await request(app).get(`/posts/${postId}/comments`);
    const root = listRes.body.comments.find(
      (c: any) => c.id === commentId
    );
    const replyId = root.replies[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/comments`)
      .set(authHeader(tokenA))
      .send({ content: "Réponse2", parent_comment_id: replyId });

    expect(res.status).toBe(400);
  });

  it("liste les commentaires (200)", async () => {
    const res = await request(app).get(`/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.comments)).toBe(true);
    expect(res.body.comments.length).toBeGreaterThan(0);
    // Chaque commentaire racine doit avoir un tableau replies
    for (const c of res.body.comments) {
      expect(Array.isArray(c.replies)).toBe(true);
    }
  });

  it("l'auteur du commentaire peut supprimer (204)", async () => {
    const res = await request(app)
      .delete(`/posts/${postId}/comments/${commentId}`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(204);
  });

  it("un autre user ne peut pas supprimer (403)", async () => {
    const addRes = await request(app)
      .post(`/posts/${postId}/comments`)
      .set(authHeader(tokenB))
      .send({ content: "Test suppression" });

    const newCommentId = addRes.body.comment.id;

    const res = await request(app)
      .delete(`/posts/${postId}/comments/${newCommentId}`)
      .set(authHeader(tokenC));

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 9. Partage
// ============================================================

describe("Posts — Partage", () => {
  let postId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ content: "Post à partager" });
    postId = res.body.post.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/share`)
      .send({});

    expect(res.status).toBe(401);
  });

  it("partage un post (201)", async () => {
    const res = await request(app)
      .post(`/posts/${postId}/share`)
      .set(authHeader(tokenB))
      .send({ share_comment: "Je partage ça !" });

    expect(res.status).toBe(201);
    expect(res.body.post).toHaveProperty("id");
    expect(res.body.post.shared_from).not.toBe(null);
    expect(res.body.post.shared_from.id).toBe(postId);
  });

  it("rejette le partage d'un post inexistant (404)", async () => {
    const res = await request(app)
      .post("/posts/999999/share")
      .set(authHeader(tokenB))
      .send({});

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 10. GET /posts/user/:userId
// ============================================================

describe("Posts — GET /posts/user/:userId", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(`/posts/user/${userAId}`);
    expect(res.status).toBe(401);
  });

  it("retourne 200 pour soi-même", async () => {
    const res = await request(app)
      .get(`/posts/user/${userAId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.posts)).toBe(true);
  });

  it("retourne 404 pour un user inexistant", async () => {
    const res = await request(app)
      .get("/posts/user/999999")
      .set(authHeader(tokenA));

    expect(res.status).toBe(404);
  });

  it("rejette un userId invalide (400)", async () => {
    const res = await request(app)
      .get("/posts/user/abc")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});
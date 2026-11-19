// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Friends
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
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

async function clearRelationships(userIds: number[]) {
  await db
    .delete(friendships)
    .where(inArray(friendships.requester_id, userIds));
  await db
    .delete(friendships)
    .where(inArray(friendships.receiver_id, userIds));
}

// ============================================================
// BEFORE ALL
// ============================================================

beforeAll(async () => {
  userAId = await upsertUser({
    email: "friendtest_a@test.com",
    username: "friendtest_a",
    first_name: "Alice",
    last_name: "Friend",
  });

  userBId = await upsertUser({
    email: "friendtest_b@test.com",
    username: "friendtest_b",
    first_name: "Bob",
    last_name: "Friend",
  });

  userCId = await upsertUser({
    email: "friendtest_c@test.com",
    username: "friendtest_c",
    first_name: "Carol",
    last_name: "Friend",
  });

  tokenA = await login("friendtest_a@test.com");
  tokenB = await login("friendtest_b@test.com");
  tokenC = await login("friendtest_c@test.com");

  await clearRelationships([userAId, userBId, userCId]);
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [userAId, userBId, userCId];

    await clearRelationships(userIds);

    await db
      .delete(notifications)
      .where(inArray(notifications.user_id, userIds));

    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));

    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /friends/stats
// ============================================================

describe("Friends — GET /friends/stats", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/friends/stats");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec token", async () => {
    const res = await request(app)
      .get("/friends/stats")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("friends_count");
    expect(res.body).toHaveProperty("pending_requests_count");
  });

  it("retourne 0 amis au départ", async () => {
    await clearRelationships([userAId, userBId, userCId]);

    const res = await request(app)
      .get("/friends/stats")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.friends_count).toBe(0);
    expect(res.body.pending_requests_count).toBe(0);
  });
});

// ============================================================
// 2. GET /friends/me
// ============================================================

describe("Friends — GET /friends/me", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/friends/me");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec liste vide au départ", async () => {
    const res = await request(app)
      .get("/friends/me")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.friends)).toBe(true);
  });
});

// ============================================================
// 3. POST /friends/request/:userId
// ============================================================

describe("Friends — POST /friends/request/:userId", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).post(`/friends/request/${userBId}`);
    expect(res.status).toBe(401);
  });

  it("envoie une demande d'ami (201)", async () => {
    const res = await request(app)
      .post(`/friends/request/${userBId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.friendship).toHaveProperty("id");
    expect(res.body.friendship.status).toBe("pending");
  });

  it("rejette un doublon (400)", async () => {
    const res = await request(app)
      .post(`/friends/request/${userBId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });

  it("rejette l'envoi à soi-même (400)", async () => {
    const res = await request(app)
      .post(`/friends/request/${userAId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });

  it("rejette un userId inexistant (404)", async () => {
    const res = await request(app)
      .post("/friends/request/999999")
      .set(authHeader(tokenA));

    expect(res.status).toBe(404);
  });

  it("rejette un userId invalide (400)", async () => {
    const res = await request(app)
      .post("/friends/request/abc")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. GET /friends/requests/sent
// ============================================================

describe("Friends — GET /friends/requests/sent", () => {
  it("retourne 200 avec liste (demande envoyée précédemment)", async () => {
    const res = await request(app)
      .get("/friends/requests/sent")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
    expect(res.body.requests.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 5. GET /friends/requests/received
// ============================================================

describe("Friends — GET /friends/requests/received", () => {
  it("B a reçu la demande de A", async () => {
    const res = await request(app)
      .get("/friends/requests/received")
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
    expect(res.body.requests.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 6. GET /friends/status/:userId
// ============================================================

describe("Friends — GET /friends/status/:userId", () => {
  it("retourne pending_sent pour A", async () => {
    const res = await request(app)
      .get(`/friends/status/${userBId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending_sent");
  });

  it("retourne pending_received pour B", async () => {
    const res = await request(app)
      .get(`/friends/status/${userAId}`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending_received");
  });

  it("retourne none pour un inconnu", async () => {
    const res = await request(app)
      .get(`/friends/status/${userCId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("none");
  });

  it("rejette avec soi-même (400)", async () => {
    const res = await request(app)
      .get(`/friends/status/${userAId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 7. PUT /friends/:id/accept
// ============================================================

describe("Friends — PUT /friends/:id/accept", () => {
  let requestId: number;

  beforeAll(async () => {
    const res = await request(app)
      .get("/friends/requests/received")
      .set(authHeader(tokenB));

    requestId = res.body.requests[0].id;
  });

  it("rejette si ce n'est pas le receiver (403)", async () => {
    const res = await request(app)
      .put(`/friends/${requestId}/accept`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(403);
  });

  it("le receiver accepte (200)", async () => {
    const res = await request(app)
      .put(`/friends/${requestId}/accept`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.friendship.status).toBe("accepted");
  });

  it("rejette une acceptation déjà traitée (400)", async () => {
    const res = await request(app)
      .put(`/friends/${requestId}/accept`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(400);
  });

  it("rejette un ID inexistant (404)", async () => {
    const res = await request(app)
      .put("/friends/999999/accept")
      .set(authHeader(tokenB));

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 8. Amitié effective (après acceptation)
// ============================================================

describe("Friends — Après acceptation", () => {
  it("A a B dans sa liste d'amis", async () => {
    const res = await request(app)
      .get("/friends/me")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.friends.length).toBeGreaterThan(0);

    const bob = res.body.friends.find((f: any) => f.id === userBId);
    expect(bob).toBeDefined();
    expect(bob.username).toBe("friendtest_b");
  });

  it("stats A : 1 ami", async () => {
    const res = await request(app)
      .get("/friends/stats")
      .set(authHeader(tokenA));

    expect(res.body.friends_count).toBeGreaterThanOrEqual(1);
  });

  it("statut A → B : friends", async () => {
    const res = await request(app)
      .get(`/friends/status/${userBId}`)
      .set(authHeader(tokenA));

    expect(res.body.status).toBe("friends");
  });
});

// ============================================================
// 9. DELETE /friends/:userId (remove)
// ============================================================

describe("Friends — DELETE /friends/:userId", () => {
  it("retire un ami (204)", async () => {
    const res = await request(app)
      .delete(`/friends/${userBId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(204);
  });

  it("statut redevient none", async () => {
    const res = await request(app)
      .get(`/friends/status/${userBId}`)
      .set(authHeader(tokenA));

    expect(res.body.status).toBe("none");
  });

  // ✅ FIX : le code renvoie 404 (pas 400) quand il n'y a AUCUNE relation
  it("rejette si aucune relation (404)", async () => {
    const res = await request(app)
      .delete(`/friends/${userBId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 10. PUT /friends/:id/decline
// ============================================================

describe("Friends — PUT /friends/:id/decline", () => {
  let requestId: number;

  beforeAll(async () => {
    await request(app)
      .post(`/friends/request/${userCId}`)
      .set(authHeader(tokenA));

    const res = await request(app)
      .get("/friends/requests/received")
      .set(authHeader(tokenC));

    requestId = res.body.requests[0].id;
  });

  it("le receiver refuse (200)", async () => {
    const res = await request(app)
      .put(`/friends/${requestId}/decline`)
      .set(authHeader(tokenC));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejette si pas le receiver (403)", async () => {
    const res = await request(app)
      .put(`/friends/${requestId}/decline`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 11. DELETE /friends/:id/cancel
// ============================================================

describe("Friends — DELETE /friends/:id/cancel", () => {
  let requestId: number;

  beforeAll(async () => {
    await request(app)
      .post(`/friends/request/${userCId}`)
      .set(authHeader(tokenB));

    const res = await request(app)
      .get("/friends/requests/sent")
      .set(authHeader(tokenB));

    requestId = res.body.requests[0].id;
  });

  it("rejette si pas le requester (403)", async () => {
    const res = await request(app)
      .delete(`/friends/${requestId}/cancel`)
      .set(authHeader(tokenC));

    expect(res.status).toBe(403);
  });

  it("le requester annule (200)", async () => {
    const res = await request(app)
      .delete(`/friends/${requestId}/cancel`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ============================================================
// 12. Stats finales
// ============================================================

describe("Friends — Stats finales", () => {
  it("A : plus de demandes en attente", async () => {
    const res = await request(app)
      .get("/friends/stats")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.pending_requests_count).toBe(0);
  });
});
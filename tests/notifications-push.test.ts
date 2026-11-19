// ============================================================
// ANKUCAMP — Tests d'intégration Notifications Push (FCM)
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  userSessions,
  pushSubscriptions,
  notifications,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// MOCK FIREBASE (config/firebase)
// ============================================================

vi.mock("../src/config/firebase", () => ({
  getFirebaseMessaging: vi.fn(() => null),
  sendPushToToken: vi.fn().mockResolvedValue(true),
  sendPushToTokens: vi.fn().mockResolvedValue([]),
}));

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

const FAKE_TOKEN_1 = "fcm_token_" + "a".repeat(150); // ~160 chars
const FAKE_TOKEN_2 = "fcm_token_" + "b".repeat(150);
const FAKE_TOKEN_3 = "fcm_token_" + "c".repeat(150);
const FAKE_TOKEN_SHORT = "abc"; // trop court (< 100)
const FAKE_TOKEN_LONG = "x".repeat(501); // trop long (> 500)

let userAId: number;
let userBId: number;
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
    throw new Error(`Login échoué pour ${email}`);
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
  // Cleanup
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.email, [
        "push_notif_a@test.com",
        "push_notif_b@test.com",
      ])
    );

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);

    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.user_id, ids));
    await db
      .delete(notifications)
      .where(inArray(notifications.user_id, ids));
    await db
      .delete(userSessions)
      .where(inArray(userSessions.user_id, ids));
    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  userAId = await upsertUser({
    email: "push_notif_a@test.com",
    username: "push_notif_a",
    first_name: "Alice",
    last_name: "Push",
  });

  userBId = await upsertUser({
    email: "push_notif_b@test.com",
    username: "push_notif_b",
    first_name: "Bob",
    last_name: "Push",
  });

  tokenA = await login("push_notif_a@test.com");
  tokenB = await login("push_notif_b@test.com");
});

// ============================================================
// AFTER ALL
// ============================================================

afterAll(async () => {
  try {
    const userIds = [userAId, userBId];

    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.user_id, userIds));
    await db
      .delete(notifications)
      .where(inArray(notifications.user_id, userIds));
    await db
      .delete(userSessions)
      .where(inArray(userSessions.user_id, userIds));
    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué :", err);
  }
});

// ============================================================
// 1. POST /notifications/push/subscribe
// ============================================================

describe("Push — POST /notifications/push/subscribe", () => {
  beforeAll(async () => {
    // Cleanup avant ce describe
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.user_id, [userAId, userBId]));
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/notifications/push/subscribe")
      .send({ token: FAKE_TOKEN_1, platform: "ios" });

    expect(res.status).toBe(401);
  });

  it("rejette un token trop court (400)", async () => {
    const res = await request(app)
      .post("/notifications/push/subscribe")
      .set(authHeader(tokenA))
      .send({ token: FAKE_TOKEN_SHORT, platform: "ios" });

    expect(res.status).toBe(400);
  });

  it("rejette un token trop long (400)", async () => {
    const res = await request(app)
      .post("/notifications/push/subscribe")
      .set(authHeader(tokenA))
      .send({ token: FAKE_TOKEN_LONG, platform: "ios" });

    expect(res.status).toBe(400);
  });

  it("rejette une platform invalide (400)", async () => {
    const res = await request(app)
      .post("/notifications/push/subscribe")
      .set(authHeader(tokenA))
      .send({ token: FAKE_TOKEN_1, platform: "nintendo" });

    expect(res.status).toBe(400);
  });

  it("crée un abonnement (201)", async () => {
    const res = await request(app)
      .post("/notifications/push/subscribe")
      .set(authHeader(tokenA))
      .send({
        token: FAKE_TOKEN_1,
        platform: "ios",
        device_info: "iPhone 15 Pro",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.subscription).toHaveProperty("id");
    expect(res.body.subscription.platform).toBe("ios");
    expect(res.body.subscription.device_info).toBe("iPhone 15 Pro");
  });

  it("crée bien une ligne en DB", async () => {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.token, FAKE_TOKEN_1));

    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe(userAId);
    expect(rows[0].platform).toBe("ios");
  });

  it("crée plusieurs devices pour le même user (multi-device)", async () => {
    const res = await request(app)
      .post("/notifications/push/subscribe")
      .set(authHeader(tokenA))
      .send({ token: FAKE_TOKEN_2, platform: "android" });

    expect(res.status).toBe(201);

    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.user_id, userAId));

    expect(rows.length).toBe(2);
  });

  it("ne crée PAS de doublon si le token existe (upsert)", async () => {
    const res = await request(app)
      .post("/notifications/push/subscribe")
      .set(authHeader(tokenA))
      .send({
        token: FAKE_TOKEN_1,
        platform: "ios",
        device_info: "iPhone 15 Pro (updated)",
      });

    expect(res.status).toBe(201);

    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.token, FAKE_TOKEN_1));

    expect(rows.length).toBe(1);
    expect(rows[0].device_info).toBe("iPhone 15 Pro (updated)");
  });
});

// ============================================================
// 2. GET /notifications/push/subscriptions
// ============================================================

describe("Push — GET /notifications/push/subscriptions", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get(
      "/notifications/push/subscriptions"
    );
    expect(res.status).toBe(401);
  });

  it("retourne mes devices (2 pour user A)", async () => {
    const res = await request(app)
      .get("/notifications/push/subscriptions")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(Array.isArray(res.body.subscriptions)).toBe(true);
  });

  it("ne retourne PAS les devices des autres users", async () => {
    const res = await request(app)
      .get("/notifications/push/subscriptions")
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it("ne retourne JAMAIS le token complet (sécurité)", async () => {
    const res = await request(app)
      .get("/notifications/push/subscriptions")
      .set(authHeader(tokenA));

    for (const sub of res.body.subscriptions) {
      expect(sub).not.toHaveProperty("token");
    }
  });
});

// ============================================================
// 3. DELETE /notifications/push/unsubscribe
// ============================================================

describe("Push — DELETE /notifications/push/unsubscribe", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .delete("/notifications/push/unsubscribe")
      .send({ token: FAKE_TOKEN_1 });

    expect(res.status).toBe(401);
  });

  it("rejette un token inconnu pour ce user (404)", async () => {
    const res = await request(app)
      .delete("/notifications/push/unsubscribe")
      .set(authHeader(tokenB))
      .send({ token: FAKE_TOKEN_1 });

    expect(res.status).toBe(404);
  });

  it("supprime un device (200)", async () => {
    const res = await request(app)
      .delete("/notifications/push/unsubscribe")
      .set(authHeader(tokenA))
      .send({ token: FAKE_TOKEN_1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("le token n'est plus en DB", async () => {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.token, FAKE_TOKEN_1));

    expect(rows.length).toBe(0);
  });

  it("il reste 1 device pour user A (FAKE_TOKEN_2)", async () => {
    const res = await request(app)
      .get("/notifications/push/subscriptions")
      .set(authHeader(tokenA));

    expect(res.body.count).toBe(1);
  });
});

// ============================================================
// 4. Fonction sendPushToUser (mock)
// ============================================================

describe("Push — sendPushToUser (mock Firebase)", () => {
  it("appelle sendPushToTokens avec les bons tokens", async () => {
    const firebase = await import("../src/config/firebase");
    const sendMock = vi.mocked(firebase.sendPushToTokens);

    sendMock.mockClear();

    // Import dynamique du service
    const { sendPushToUser } = await import(
      "../src/core/api/notifications/push/push.service"
    );

    await sendPushToUser(userAId, "Test title", "Test body", {
      type: "test",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);

    const args = sendMock.mock.calls[0];
    expect(args[0]).toEqual([FAKE_TOKEN_2]); // tokens
    expect(args[1]).toBe("Test title"); // title
    expect(args[2]).toBe("Test body"); // body
    expect(args[3]).toEqual({ type: "test" }); // data
  });

  it("ne fait rien si le user n'a aucun token", async () => {
    const firebase = await import("../src/config/firebase");
    const sendMock = vi.mocked(firebase.sendPushToTokens);

    sendMock.mockClear();

    const { sendPushToUser } = await import(
      "../src/core/api/notifications/push/push.service"
    );

    // User B n'a pas de token
    await sendPushToUser(userBId, "Test", "Test");

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("supprime les tokens invalides retournés par Firebase", async () => {
    // Ajoute un token pour user B
    await db.insert(pushSubscriptions).values({
      user_id: userBId,
      token: FAKE_TOKEN_3,
      platform: "web",
    });

    const firebase = await import("../src/config/firebase");
    const sendMock = vi.mocked(firebase.sendPushToTokens);

    // Simule que Firebase considère FAKE_TOKEN_3 comme invalide
    sendMock.mockResolvedValueOnce([FAKE_TOKEN_3]);

    const { sendPushToUser } = await import(
      "../src/core/api/notifications/push/push.service"
    );

    await sendPushToUser(userBId, "Test", "Test");

    // Vérifie que FAKE_TOKEN_3 a été supprimé
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.token, FAKE_TOKEN_3));

    expect(rows.length).toBe(0);
  });
});
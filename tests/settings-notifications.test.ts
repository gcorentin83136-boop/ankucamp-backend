// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Settings > Notifications
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import { users, userSettings, userSessions } from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let userAId: number;
let tokenA: string;

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
      .set({
        password_hash: hash,
        email_verified: 1,
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
        role: "particulier",
        email_verified: 1,
        password_hash: hash,
      })
      .returning();

    userId = created.id;
  }

  // ✅ PAS de création de userSettings ici → on veut tester le lazy create
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
    .where(eq(users.email, "notifset_a@test.com"));

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  userAId = await upsertUser({
    email: "notifset_a@test.com",
    username: "notifset_a",
    first_name: "Alice",
    last_name: "Notif",
  });

  tokenA = await login("notifset_a@test.com");
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    await db
      .delete(userSessions)
      .where(eq(userSessions.user_id, userAId));
    await db
      .delete(userSettings)
      .where(eq(userSettings.user_id, userAId));
    await db.delete(users).where(eq(users.id, userAId));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /settings/notifications
// ============================================================

describe("Settings Notifications — GET /settings/notifications", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/settings/notifications");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les préférences (lazy create)", async () => {
    const res = await request(app)
      .get("/settings/notifications")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notifications).toHaveProperty("email");
    expect(res.body.notifications).toHaveProperty("push");
  });

  it("retourne les valeurs par défaut (email)", async () => {
    const res = await request(app)
      .get("/settings/notifications")
      .set(authHeader(tokenA));

    expect(res.body.notifications.email.order_updates).toBe(true);
    expect(res.body.notifications.email.new_messages).toBe(true);
    expect(res.body.notifications.email.social_activity).toBe(true);
    expect(res.body.notifications.email.marketing).toBe(false);
  });

  it("retourne les valeurs par défaut (push)", async () => {
    const res = await request(app)
      .get("/settings/notifications")
      .set(authHeader(tokenA));

    expect(res.body.notifications.push.order_updates).toBe(true);
    expect(res.body.notifications.push.new_messages).toBe(true);
    expect(res.body.notifications.push.social_activity).toBe(true);
  });

  it("les préférences sont bien des booléens (pas 0/1)", async () => {
    const res = await request(app)
      .get("/settings/notifications")
      .set(authHeader(tokenA));

    expect(typeof res.body.notifications.email.order_updates).toBe("boolean");
    expect(typeof res.body.notifications.push.order_updates).toBe("boolean");
  });
});

// ============================================================
// 2. PUT /settings/notifications (update ALL)
// ============================================================

describe("Settings Notifications — PUT /settings/notifications", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/notifications")
      .send({ email_marketing: true });

    expect(res.status).toBe(401);
  });

  it("met à jour tous les champs (200)", async () => {
    const res = await request(app)
      .put("/settings/notifications")
      .set(authHeader(tokenA))
      .send({
        email_order_updates: false,
        email_new_messages: false,
        email_social_activity: false,
        email_marketing: true,
        push_order_updates: false,
        push_new_messages: false,
        push_social_activity: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(res.body.notifications.email.order_updates).toBe(false);
    expect(res.body.notifications.email.new_messages).toBe(false);
    expect(res.body.notifications.email.social_activity).toBe(false);
    expect(res.body.notifications.email.marketing).toBe(true);

    expect(res.body.notifications.push.order_updates).toBe(false);
    expect(res.body.notifications.push.new_messages).toBe(false);
    expect(res.body.notifications.push.social_activity).toBe(false);
  });

  it("accepte un body vide (pas d'erreur, pas de changement)", async () => {
    const res = await request(app)
      .put("/settings/notifications")
      .set(authHeader(tokenA))
      .send({});

    expect(res.status).toBe(200);
  });

  it("met à jour seulement certains champs", async () => {
    // Remet tout à true d'abord
    await request(app)
      .put("/settings/notifications")
      .set(authHeader(tokenA))
      .send({
        email_order_updates: true,
        email_new_messages: true,
        email_social_activity: true,
        email_marketing: false,
        push_order_updates: true,
        push_new_messages: true,
        push_social_activity: true,
      });

    // Puis change juste email_marketing
    const res = await request(app)
      .put("/settings/notifications")
      .set(authHeader(tokenA))
      .send({ email_marketing: true });

    expect(res.status).toBe(200);
    expect(res.body.notifications.email.marketing).toBe(true);
    // Les autres sont restés à true
    expect(res.body.notifications.email.order_updates).toBe(true);
  });
});

// ============================================================
// 3. PUT /settings/notifications/email
// ============================================================

describe("Settings Notifications — PUT /settings/notifications/email", () => {
  beforeAll(async () => {
    // Reset à tout true
    await request(app)
      .put("/settings/notifications")
      .set(authHeader(tokenA))
      .send({
        email_order_updates: true,
        email_new_messages: true,
        email_social_activity: true,
        email_marketing: false,
        push_order_updates: true,
        push_new_messages: true,
        push_social_activity: true,
      });
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/notifications/email")
      .send({ email_marketing: true });

    expect(res.status).toBe(401);
  });

  it("met à jour les préférences email (200)", async () => {
    const res = await request(app)
      .put("/settings/notifications/email")
      .set(authHeader(tokenA))
      .send({
        email_order_updates: false,
        email_marketing: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.notifications.email.order_updates).toBe(false);
    expect(res.body.notifications.email.marketing).toBe(true);
    // Les autres email n'ont pas changé
    expect(res.body.notifications.email.new_messages).toBe(true);
    expect(res.body.notifications.email.social_activity).toBe(true);
  });

  it("ne touche PAS aux préférences push", async () => {
    const res = await request(app)
      .put("/settings/notifications/email")
      .set(authHeader(tokenA))
      .send({ email_order_updates: true });

    expect(res.status).toBe(200);
    // Push doit rester intact (true)
    expect(res.body.notifications.push.order_updates).toBe(true);
    expect(res.body.notifications.push.new_messages).toBe(true);
    expect(res.body.notifications.push.social_activity).toBe(true);
  });
});

// ============================================================
// 4. PUT /settings/notifications/push
// ============================================================

describe("Settings Notifications — PUT /settings/notifications/push", () => {
  beforeAll(async () => {
    // Reset à tout true
    await request(app)
      .put("/settings/notifications")
      .set(authHeader(tokenA))
      .send({
        email_order_updates: true,
        email_new_messages: true,
        email_social_activity: true,
        email_marketing: true,
        push_order_updates: true,
        push_new_messages: true,
        push_social_activity: true,
      });
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/notifications/push")
      .send({ push_order_updates: false });

    expect(res.status).toBe(401);
  });

  it("met à jour les préférences push (200)", async () => {
    const res = await request(app)
      .put("/settings/notifications/push")
      .set(authHeader(tokenA))
      .send({
        push_order_updates: false,
        push_social_activity: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.notifications.push.order_updates).toBe(false);
    expect(res.body.notifications.push.social_activity).toBe(false);
    // Les autres push n'ont pas changé
    expect(res.body.notifications.push.new_messages).toBe(true);
  });

  it("ne touche PAS aux préférences email", async () => {
    const res = await request(app)
      .put("/settings/notifications/push")
      .set(authHeader(tokenA))
      .send({ push_new_messages: false });

    expect(res.status).toBe(200);
    // Email doit rester intact
    expect(res.body.notifications.email.order_updates).toBe(true);
    expect(res.body.notifications.email.marketing).toBe(true);
  });
});

// ============================================================
// 5. Persistance en DB
// ============================================================

describe("Settings Notifications — Persistance", () => {
  it("les changements sont bien persistés en DB", async () => {
    await request(app)
      .put("/settings/notifications")
      .set(authHeader(tokenA))
      .send({
        email_marketing: true,
        push_social_activity: false,
      });

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userAId))
      .limit(1);

    expect(settings.email_marketing).toBe(1);
    expect(settings.push_social_activity).toBe(0);
  });

  it("GET retourne les valeurs persistées", async () => {
    const res = await request(app)
      .get("/settings/notifications")
      .set(authHeader(tokenA));

    expect(res.body.notifications.email.marketing).toBe(true);
    expect(res.body.notifications.push.social_activity).toBe(false);
  });
});
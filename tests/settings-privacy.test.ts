// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Settings > Privacy
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
    .where(eq(users.email, "privset_a@test.com"));

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  userAId = await upsertUser({
    email: "privset_a@test.com",
    username: "privset_a",
    first_name: "Alice",
    last_name: "Privacy",
  });

  tokenA = await login("privset_a@test.com");
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
// 1. GET /settings/privacy
// ============================================================

describe("Settings Privacy — GET /settings/privacy", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/settings/privacy");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les préférences (lazy create)", async () => {
    const res = await request(app)
      .get("/settings/privacy")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.privacy).toHaveProperty("profile_visibility");
    expect(res.body.privacy).toHaveProperty("allow_messages_from");
    expect(res.body.privacy).toHaveProperty("show_email");
    expect(res.body.privacy).toHaveProperty("show_phone");
    expect(res.body.privacy).toHaveProperty("search_indexable");
  });

  it("retourne les valeurs par défaut", async () => {
    const res = await request(app)
      .get("/settings/privacy")
      .set(authHeader(tokenA));

    expect(res.body.privacy.profile_visibility).toBe("public");
    expect(res.body.privacy.allow_messages_from).toBe("everyone");
    expect(res.body.privacy.show_email).toBe(false);
    expect(res.body.privacy.show_phone).toBe(false);
    expect(res.body.privacy.search_indexable).toBe(true);
  });

  it("les booléens sont bien des true/false", async () => {
    const res = await request(app)
      .get("/settings/privacy")
      .set(authHeader(tokenA));

    expect(typeof res.body.privacy.show_email).toBe("boolean");
    expect(typeof res.body.privacy.show_phone).toBe("boolean");
    expect(typeof res.body.privacy.search_indexable).toBe("boolean");
  });
});

// ============================================================
// 2. PUT /settings/privacy (update ALL)
// ============================================================

describe("Settings Privacy — PUT /settings/privacy", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/privacy")
      .send({ profile_visibility: "private" });

    expect(res.status).toBe(401);
  });

  it("met à jour tout (200)", async () => {
    const res = await request(app)
      .put("/settings/privacy")
      .set(authHeader(tokenA))
      .send({
        profile_visibility: "friends",
        allow_messages_from: "friends",
        show_email: true,
        show_phone: true,
        search_indexable: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.privacy.profile_visibility).toBe("friends");
    expect(res.body.privacy.allow_messages_from).toBe("friends");
    expect(res.body.privacy.show_email).toBe(true);
    expect(res.body.privacy.show_phone).toBe(true);
    expect(res.body.privacy.search_indexable).toBe(false);
  });

  it("sync is_private = 1 quand visibility = private", async () => {
    await request(app)
      .put("/settings/privacy")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "private" });

    const [user] = await db
      .select({ is_private: users.is_private })
      .from(users)
      .where(eq(users.id, userAId))
      .limit(1);

    expect(user.is_private).toBe(1);
  });

  it("sync is_private = 0 quand visibility = public", async () => {
    await request(app)
      .put("/settings/privacy")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "public" });

    const [user] = await db
      .select({ is_private: users.is_private })
      .from(users)
      .where(eq(users.id, userAId))
      .limit(1);

    expect(user.is_private).toBe(0);
  });

  it("sync is_private = 0 quand visibility = friends", async () => {
    await request(app)
      .put("/settings/privacy")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "friends" });

    const [user] = await db
      .select({ is_private: users.is_private })
      .from(users)
      .where(eq(users.id, userAId))
      .limit(1);

    expect(user.is_private).toBe(0);
  });

  it("rejette une visibility invalide (400)", async () => {
    const res = await request(app)
      .put("/settings/privacy")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "invalid" });

    expect(res.status).toBe(400);
  });

  it("rejette allow_messages_from invalide (400)", async () => {
    const res = await request(app)
      .put("/settings/privacy")
      .set(authHeader(tokenA))
      .send({ allow_messages_from: "invalid" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 3. PUT /settings/privacy/visibility
// ============================================================

describe("Settings Privacy — PUT /settings/privacy/visibility", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/privacy/visibility")
      .send({ profile_visibility: "public" });

    expect(res.status).toBe(401);
  });

  it("change la visibilité en private (200)", async () => {
    const res = await request(app)
      .put("/settings/privacy/visibility")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "private" });

    expect(res.status).toBe(200);
    expect(res.body.privacy.profile_visibility).toBe("private");
  });

  it("sync is_private = 1 en DB", async () => {
    const [user] = await db
      .select({ is_private: users.is_private })
      .from(users)
      .where(eq(users.id, userAId))
      .limit(1);

    expect(user.is_private).toBe(1);
  });

  it("change la visibilité en public (200)", async () => {
    const res = await request(app)
      .put("/settings/privacy/visibility")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "public" });

    expect(res.status).toBe(200);
    expect(res.body.privacy.profile_visibility).toBe("public");
  });

  it("sync is_private = 0 en DB", async () => {
    const [user] = await db
      .select({ is_private: users.is_private })
      .from(users)
      .where(eq(users.id, userAId))
      .limit(1);

    expect(user.is_private).toBe(0);
  });

  it("rejette une visibility invalide (400)", async () => {
    const res = await request(app)
      .put("/settings/privacy/visibility")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "invalid" });

    expect(res.status).toBe(400);
  });

  it("rejette un body vide (400)", async () => {
    const res = await request(app)
      .put("/settings/privacy/visibility")
      .set(authHeader(tokenA))
      .send({});

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. PUT /settings/privacy/messages
// ============================================================

describe("Settings Privacy — PUT /settings/privacy/messages", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/privacy/messages")
      .send({ allow_messages_from: "friends" });

    expect(res.status).toBe(401);
  });

  it("change allow_messages_from → friends (200)", async () => {
    const res = await request(app)
      .put("/settings/privacy/messages")
      .set(authHeader(tokenA))
      .send({ allow_messages_from: "friends" });

    expect(res.status).toBe(200);
    expect(res.body.privacy.allow_messages_from).toBe("friends");
  });

  it("change allow_messages_from → nobody (200)", async () => {
    const res = await request(app)
      .put("/settings/privacy/messages")
      .set(authHeader(tokenA))
      .send({ allow_messages_from: "nobody" });

    expect(res.status).toBe(200);
    expect(res.body.privacy.allow_messages_from).toBe("nobody");
  });

  it("change allow_messages_from → everyone (200)", async () => {
    const res = await request(app)
      .put("/settings/privacy/messages")
      .set(authHeader(tokenA))
      .send({ allow_messages_from: "everyone" });

    expect(res.status).toBe(200);
    expect(res.body.privacy.allow_messages_from).toBe("everyone");
  });

  it("ne touche PAS à profile_visibility", async () => {
    // D'abord mettre en private
    await request(app)
      .put("/settings/privacy/visibility")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "private" });

    // Puis changer allow_messages_from
    const res = await request(app)
      .put("/settings/privacy/messages")
      .set(authHeader(tokenA))
      .send({ allow_messages_from: "friends" });

    expect(res.body.privacy.profile_visibility).toBe("private");
    expect(res.body.privacy.allow_messages_from).toBe("friends");

    // Reset
    await request(app)
      .put("/settings/privacy/visibility")
      .set(authHeader(tokenA))
      .send({ profile_visibility: "public" });
  });

  it("rejette une valeur invalide (400)", async () => {
    const res = await request(app)
      .put("/settings/privacy/messages")
      .set(authHeader(tokenA))
      .send({ allow_messages_from: "invalid" });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 5. Persistance en DB
// ============================================================

describe("Settings Privacy — Persistance", () => {
  it("les changements sont bien persistés en DB", async () => {
    await request(app)
      .put("/settings/privacy")
      .set(authHeader(tokenA))
      .send({
        profile_visibility: "friends",
        show_email: true,
        search_indexable: false,
      });

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userAId))
      .limit(1);

    expect(settings.profile_visibility).toBe("friends");
    expect(settings.show_email).toBe(1);
    expect(settings.search_indexable).toBe(0);
  });

  it("GET retourne les valeurs persistées", async () => {
    const res = await request(app)
      .get("/settings/privacy")
      .set(authHeader(tokenA));

    expect(res.body.privacy.profile_visibility).toBe("friends");
    expect(res.body.privacy.show_email).toBe(true);
    expect(res.body.privacy.search_indexable).toBe(false);
  });
});
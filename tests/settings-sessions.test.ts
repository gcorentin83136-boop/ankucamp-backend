// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Settings > Sessions
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  userSessions,
} from "../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// ============================================================
// CONFIG
// ============================================================

const PASSWORD = "Test1234!";

let userAId: number;

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

async function countSessions(userId: number): Promise<number> {
  const sessions = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(eq(userSessions.user_id, userId));
  return sessions.length;
}

async function clearSessions(userId: number): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.user_id, userId));
}

// ============================================================
// BEFORE ALL
// ============================================================

beforeAll(async () => {
  // Cleanup préalable
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "sesset_a@test.com"));

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  userAId = await upsertUser({
    email: "sesset_a@test.com",
    username: "sesset_a",
    first_name: "Alice",
    last_name: "Session",
  });
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    await clearSessions(userAId);
    await db.delete(userSettings).where(eq(userSettings.user_id, userAId));
    await db.delete(users).where(eq(users.id, userAId));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /settings/sessions
// ============================================================

describe("Settings Sessions — GET /settings/sessions", () => {
  let token: string;

  beforeAll(async () => {
    // Setup : 3 sessions fraîches
    await clearSessions(userAId);
    await login("sesset_a@test.com");
    await login("sesset_a@test.com");
    token = await login("sesset_a@test.com");
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/settings/sessions");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec la liste des sessions", async () => {
    const res = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.count).toBe(3);
  });

  it("marque la session courante (is_current = true)", async () => {
    const res = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    const currents = res.body.sessions.filter(
      (s: any) => s.is_current === true
    );
    expect(currents.length).toBe(1);
  });

  it("les autres sessions ne sont pas marquées", async () => {
    const res = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    const others = res.body.sessions.filter(
      (s: any) => s.is_current === false
    );
    expect(others.length).toBe(2);
  });

  it("retourne les infos attendues par session", async () => {
    const res = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    const s = res.body.sessions[0];
    expect(s).toHaveProperty("id");
    expect(s).toHaveProperty("device_info");
    expect(s).toHaveProperty("ip_address");
    expect(s).toHaveProperty("created_at");
    expect(s).toHaveProperty("last_active_at");
    expect(s).toHaveProperty("expires_at");
    expect(s).toHaveProperty("is_current");
  });

  it("ne retourne JAMAIS token_hash", async () => {
    const res = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    for (const s of res.body.sessions) {
      expect(s).not.toHaveProperty("token_hash");
    }
  });
});

// ============================================================
// 2. DELETE /settings/sessions/:id
// ============================================================

describe("Settings Sessions — DELETE /settings/sessions/:id", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).delete("/settings/sessions/999");
    expect(res.status).toBe(401);
  });

  it("rejette la révocation de la session courante (400)", async () => {
    await clearSessions(userAId);
    const token = await login("sesset_a@test.com");

    const listRes = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    const current = listRes.body.sessions.find((s: any) => s.is_current);

    const res = await request(app)
      .delete(`/settings/sessions/${current.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });

  it("révoque une autre session (200)", async () => {
    await clearSessions(userAId);
    await login("sesset_a@test.com"); // autre
    const token = await login("sesset_a@test.com"); // courante

    const listRes = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    const other = listRes.body.sessions.find((s: any) => !s.is_current);
    expect(other).toBeDefined();

    const res = await request(app)
      .delete(`/settings/sessions/${other.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Vérifie qu'il reste 1 session
    const count = await countSessions(userAId);
    expect(count).toBe(1);
  });

  it("retourne 404 pour une session inexistante", async () => {
    const token = await login("sesset_a@test.com");

    const res = await request(app)
      .delete("/settings/sessions/999999")
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });

  it("rejette un ID invalide (400)", async () => {
    const token = await login("sesset_a@test.com");

    const res = await request(app)
      .delete("/settings/sessions/abc")
      .set(authHeader(token));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 3. DELETE /settings/sessions/all
// ============================================================

describe("Settings Sessions — DELETE /settings/sessions/all", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).delete("/settings/sessions/all");
    expect(res.status).toBe(401);
  });

  it("révoque toutes les autres sessions (200)", async () => {
    await clearSessions(userAId);

    // Crée 3 sessions fraîches
    await login("sesset_a@test.com");
    await login("sesset_a@test.com");
    const token = await login("sesset_a@test.com"); // courante

    const before = await countSessions(userAId);
    expect(before).toBe(3);

    const res = await request(app)
      .delete("/settings/sessions/all")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);

    // Vérifie en DB : 1 session
    const after = await countSessions(userAId);
    expect(after).toBe(1);
  });

  it("la session courante reste valide après revokeAll", async () => {
    await clearSessions(userAId);

    await login("sesset_a@test.com"); // autre
    const token = await login("sesset_a@test.com"); // courante

    await request(app)
      .delete("/settings/sessions/all")
      .set(authHeader(token));

    // Vérifie que le token fonctionne toujours
    const res = await request(app)
      .get("/settings/sessions")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].is_current).toBe(true);
  });

  it("retourne count = 0 si aucune autre session", async () => {
    await clearSessions(userAId);

    // Crée 1 seule session
    const token = await login("sesset_a@test.com");

    const res = await request(app)
      .delete("/settings/sessions/all")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

// ============================================================
// 4. Persistance DB
// ============================================================

describe("Settings Sessions — Persistance DB", () => {
  it("les sessions révoquées sont bien supprimées de la DB", async () => {
    await clearSessions(userAId);

    // Crée 3 sessions fraîches
    await login("sesset_a@test.com");
    await login("sesset_a@test.com");
    const token = await login("sesset_a@test.com"); // courante

    // Revoke all
    await request(app)
      .delete("/settings/sessions/all")
      .set(authHeader(token));

    // Vérifie en DB : 1 session
    const sessions = await db
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(eq(userSessions.user_id, userAId));

    expect(sessions.length).toBe(1);
  });
});
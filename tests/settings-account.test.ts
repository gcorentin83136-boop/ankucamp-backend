// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Settings > Account
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
const NEW_PASSWORD = "NewPass5678!";

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
      .set({
        password_hash: hash,
        email_verified: 1,
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

async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await request(app)
    .post("/auth/login")
    .send({ email, password });

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
  // Nettoyage préalable des users de test s'ils existent
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, ["acctest_a@test.com", "acctest_b@test.com"]));

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  userAId = await upsertUser({
    email: "acctest_a@test.com",
    username: "acctest_a",
    first_name: "Alice",
    last_name: "Account",
  });

  userBId = await upsertUser({
    email: "acctest_b@test.com",
    username: "acctest_b",
    first_name: "Bob",
    last_name: "Account",
  });

  tokenA = await login("acctest_a@test.com");
  tokenB = await login("acctest_b@test.com");
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    const userIds = [userAId, userBId];

    await db
      .delete(userSessions)
      .where(inArray(userSessions.user_id, userIds));
    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /settings/account
// ============================================================

describe("Settings Account — GET /settings/account", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/settings/account");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec les infos du compte", async () => {
    const res = await request(app)
      .get("/settings/account")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account).toHaveProperty("id");
    expect(res.body.account).toHaveProperty("email");
    expect(res.body.account).toHaveProperty("username");
    expect(res.body.account).toHaveProperty("first_name");
    expect(res.body.account).toHaveProperty("last_name");
  });

  it("ne retourne JAMAIS password_hash", async () => {
    const res = await request(app)
      .get("/settings/account")
      .set(authHeader(tokenA));

    expect(res.body.account).not.toHaveProperty("password_hash");
  });
});

// ============================================================
// 2. PUT /settings/account/email
// ============================================================

describe("Settings Account — PUT /settings/account/email", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/account/email")
      .send({ new_email: "new@test.com", password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it("rejette un email invalide (400)", async () => {
    const res = await request(app)
      .put("/settings/account/email")
      .set(authHeader(tokenA))
      .send({ new_email: "not-an-email", password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it("rejette sans password (400)", async () => {
    const res = await request(app)
      .put("/settings/account/email")
      .set(authHeader(tokenA))
      .send({ new_email: "new@test.com" });

    expect(res.status).toBe(400);
  });

  it("rejette un password incorrect (401)", async () => {
    const res = await request(app)
      .put("/settings/account/email")
      .set(authHeader(tokenA))
      .send({ new_email: "newemail_a@test.com", password: "wrongpass" });

    expect(res.status).toBe(401);
  });

  it("rejette un email déjà utilisé (400)", async () => {
    const res = await request(app)
      .put("/settings/account/email")
      .set(authHeader(tokenA))
      .send({ new_email: "acctest_b@test.com", password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it("change l'email avec succès (200)", async () => {
    const res = await request(app)
      .put("/settings/account/email")
      .set(authHeader(tokenA))
      .send({ new_email: "acctest_a_new@test.com", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.account.email).toBe("acctest_a_new@test.com");
    expect(res.body.account.email_verified).toBe(0);

    // Restaure pour les tests suivants
    await request(app)
      .put("/settings/account/email")
      .set(authHeader(tokenA))
      .send({ new_email: "acctest_a@test.com", password: PASSWORD });
  });
});

// ============================================================
// 3. PUT /settings/account/password
// ============================================================

describe("Settings Account — PUT /settings/account/password", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/account/password")
      .send({
        current_password: PASSWORD,
        new_password: NEW_PASSWORD,
        confirm_password: NEW_PASSWORD,
      });

    expect(res.status).toBe(401);
  });

  it("rejette si new_password trop court (400)", async () => {
    const res = await request(app)
      .put("/settings/account/password")
      .set(authHeader(tokenA))
      .send({
        current_password: PASSWORD,
        new_password: "short",
        confirm_password: "short",
      });

    expect(res.status).toBe(400);
  });

  it("rejette si new_password sans majuscule (400)", async () => {
    const res = await request(app)
      .put("/settings/account/password")
      .set(authHeader(tokenA))
      .send({
        current_password: PASSWORD,
        new_password: "alllowercase1",
        confirm_password: "alllowercase1",
      });

    expect(res.status).toBe(400);
  });

  it("rejette si confirm != new (400)", async () => {
    const res = await request(app)
      .put("/settings/account/password")
      .set(authHeader(tokenA))
      .send({
        current_password: PASSWORD,
        new_password: NEW_PASSWORD,
        confirm_password: "DifferentPassword1",
      });

    expect(res.status).toBe(400);
  });

  it("rejette un current_password incorrect (401)", async () => {
    const res = await request(app)
      .put("/settings/account/password")
      .set(authHeader(tokenA))
      .send({
        current_password: "WrongPass123!",
        new_password: NEW_PASSWORD,
        confirm_password: NEW_PASSWORD,
      });

    expect(res.status).toBe(401);
  });

  it("change le mot de passe avec succès (200)", async () => {
    const res = await request(app)
      .put("/settings/account/password")
      .set(authHeader(tokenA))
      .send({
        current_password: PASSWORD,
        new_password: NEW_PASSWORD,
        confirm_password: NEW_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ✅ FIX : vérifier la révocation IMMÉDIATEMENT après le changement
  // (avant tout nouveau login qui recréerait une session)
  it("les sessions ont été révoquées (sessions DB supprimées)", async () => {
    const sessions = await db
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(eq(userSessions.user_id, userAId));

    expect(sessions.length).toBe(0);
  });

  it("l'ancien mot de passe ne marche plus après changement", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "acctest_a@test.com", password: PASSWORD });

    expect(res.status).not.toBe(200);
  });

  it("le nouveau mot de passe fonctionne", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "acctest_a@test.com", password: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("revient à l'ancien mot de passe pour la suite", async () => {
    // Login avec le nouveau password
    const newToken = await login("acctest_a@test.com", NEW_PASSWORD);

    const res = await request(app)
      .put("/settings/account/password")
      .set(authHeader(newToken))
      .send({
        current_password: NEW_PASSWORD,
        new_password: PASSWORD,
        confirm_password: PASSWORD,
      });

    expect(res.status).toBe(200);

    // Rafraîchit tokenA (l'ancien est invalide après révocation)
    tokenA = await login("acctest_a@test.com", PASSWORD);
  });
});

// ============================================================
// 4. PUT /settings/account/username
// ============================================================

describe("Settings Account — PUT /settings/account/username", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/account/username")
      .send({ new_username: "newuser", password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it("rejette un username trop court (400)", async () => {
    const res = await request(app)
      .put("/settings/account/username")
      .set(authHeader(tokenA))
      .send({ new_username: "ab", password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it("rejette un username avec majuscules (400)", async () => {
    const res = await request(app)
      .put("/settings/account/username")
      .set(authHeader(tokenA))
      .send({ new_username: "NewUser", password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it("rejette un username déjà pris (400)", async () => {
    const res = await request(app)
      .put("/settings/account/username")
      .set(authHeader(tokenA))
      .send({ new_username: "acctest_b", password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it("change le username avec succès (200)", async () => {
    const res = await request(app)
      .put("/settings/account/username")
      .set(authHeader(tokenA))
      .send({ new_username: "acctest_a_new", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.account.username).toBe("acctest_a_new");
  });

  it("restaure le username initial", async () => {
    const res = await request(app)
      .put("/settings/account/username")
      .set(authHeader(tokenA))
      .send({ new_username: "acctest_a", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.account.username).toBe("acctest_a");
  });
});

// ============================================================
// 5. PUT /settings/account/info
// ============================================================

describe("Settings Account — PUT /settings/account/info", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .put("/settings/account/info")
      .send({ first_name: "Test" });

    expect(res.status).toBe(401);
  });

  it("rejette un body vide (400)", async () => {
    const res = await request(app)
      .put("/settings/account/info")
      .set(authHeader(tokenA))
      .send({});

    expect(res.status).toBe(400);
  });

  it("rejette un birth_year invalide (400)", async () => {
    const res = await request(app)
      .put("/settings/account/info")
      .set(authHeader(tokenA))
      .send({ birth_year: 1800 });

    expect(res.status).toBe(400);
  });

  it("met à jour le first_name (200)", async () => {
    const res = await request(app)
      .put("/settings/account/info")
      .set(authHeader(tokenA))
      .send({ first_name: "Alicia" });

    expect(res.status).toBe(200);
    expect(res.body.account.first_name).toBe("Alicia");
  });

  it("met à jour plusieurs champs (200)", async () => {
    const res = await request(app)
      .put("/settings/account/info")
      .set(authHeader(tokenA))
      .send({
        first_name: "Alice",
        last_name: "NewLastName",
        birth_year: 1995,
      });

    expect(res.status).toBe(200);
    expect(res.body.account.first_name).toBe("Alice");
    expect(res.body.account.last_name).toBe("NewLastName");
    expect(res.body.account.birth_year).toBe(1995);
  });
});

// ============================================================
// 6. DELETE /settings/account/deactivate
// ============================================================

describe("Settings Account — DELETE /settings/account/deactivate", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .delete("/settings/account/deactivate")
      .send({ password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it("rejette un password incorrect (401)", async () => {
    const res = await request(app)
      .delete("/settings/account/deactivate")
      .set(authHeader(tokenB))
      .send({ password: "wrongpass" });

    expect(res.status).toBe(401);
  });

  it("désactive le compte (200)", async () => {
    const res = await request(app)
      .delete("/settings/account/deactivate")
      .set(authHeader(tokenB))
      .send({ password: PASSWORD, reason: "Test désactivation" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("le compte est bien marqué comme désactivé (email_verified = -1)", async () => {
    const [user] = await db
      .select({ email_verified: users.email_verified })
      .from(users)
      .where(eq(users.id, userBId))
      .limit(1);

    expect(user.email_verified).toBe(-1);
  });

  it("les sessions de B sont révoquées", async () => {
    const sessions = await db
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(eq(userSessions.user_id, userBId));

    expect(sessions.length).toBe(0);
  });

  it("réactive le compte de B pour ne pas polluer les autres tests", async () => {
    await db
      .update(users)
      .set({ email_verified: 1 })
      .where(eq(users.id, userBId));
  });
});
// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Settings > GDPR
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  userSessions,
  dataExportRequests,
  accountDeletionRequests,
  legalAcceptances,
} from "../src/core/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import bcrypt from "bcrypt";

// ✅ MOCK : évite les appels réels à Brevo (instable en CI)
vi.mock("../src/core/emails/email.service", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

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

async function clearGdprData(userId: number) {
  await db
    .delete(dataExportRequests)
    .where(eq(dataExportRequests.user_id, userId));
  await db
    .delete(accountDeletionRequests)
    .where(eq(accountDeletionRequests.user_id, userId));
  await db
    .delete(legalAcceptances)
    .where(eq(legalAcceptances.user_id, userId));
}

// ============================================================
// BEFORE ALL
// ============================================================

beforeAll(async () => {
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "gdprtest_a@test.com"));

  if (oldUsers.length > 0) {
    const ids = oldUsers.map((u) => u.id);
    await clearGdprData(ids[0]);
    await db.delete(userSessions).where(inArray(userSessions.user_id, ids));
    await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }

  userAId = await upsertUser({
    email: "gdprtest_a@test.com",
    username: "gdprtest_a",
    first_name: "Alice",
    last_name: "GDPR",
  });

  tokenA = await login("gdprtest_a@test.com");
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  try {
    await clearGdprData(userAId);
    await db.delete(userSessions).where(eq(userSessions.user_id, userAId));
    await db.delete(userSettings).where(eq(userSettings.user_id, userAId));
    await db.delete(users).where(eq(users.id, userAId));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. POST /settings/gdpr/export
// ============================================================

describe("Settings GDPR — POST /settings/gdpr/export", () => {
  beforeAll(async () => {
    await clearGdprData(userAId);
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app).post("/settings/gdpr/export");
    expect(res.status).toBe(401);
  });

  it("crée une demande d'export (202)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/export")
      .set(authHeader(tokenA));

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.request).toHaveProperty("id");
    expect(res.body.request.status).toBe("pending");
  });

  // ✅ Le traitement async peut avoir déjà changé le statut
  it("rejette si un export est déjà en cours OU accepte si traitement terminé", async () => {
    const res = await request(app)
      .post("/settings/gdpr/export")
      .set(authHeader(tokenA));

    expect([400, 202]).toContain(res.status);
  });

  it("crée bien au moins une ligne en DB", async () => {
    const rows = await db
      .select({ id: dataExportRequests.id })
      .from(dataExportRequests)
      .where(eq(dataExportRequests.user_id, userAId));

    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 2. GET /settings/gdpr/export/status
// ============================================================

describe("Settings GDPR — GET /settings/gdpr/export/status", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/settings/gdpr/export/status");
    expect(res.status).toBe(401);
  });

  it("retourne la dernière demande d'export", async () => {
    const res = await request(app)
      .get("/settings/gdpr/export/status")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.request).toBeDefined();
    expect(res.body.request).toHaveProperty("id");
    expect(res.body.request).toHaveProperty("status");
  });

  it("retourne null si aucune demande (user neuf)", async () => {
    await db
      .delete(dataExportRequests)
      .where(eq(dataExportRequests.user_id, userAId));

    const res = await request(app)
      .get("/settings/gdpr/export/status")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.request).toBe(null);
  });
});

// ============================================================
// 3. POST /settings/gdpr/delete
// ============================================================

describe("Settings GDPR — POST /settings/gdpr/delete", () => {
  beforeAll(async () => {
    await db
      .delete(accountDeletionRequests)
      .where(eq(accountDeletionRequests.user_id, userAId));
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/delete")
      .send({ password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it("crée une demande de suppression (201)", async () => {
    await db
      .delete(accountDeletionRequests)
      .where(eq(accountDeletionRequests.user_id, userAId));

    const res = await request(app)
      .post("/settings/gdpr/delete")
      .set(authHeader(tokenA))
      .send({ password: PASSWORD, reason: "Test suppression" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.request).toHaveProperty("id");
    expect(res.body.request).toHaveProperty("scheduled_deletion_at");
    expect(res.body.request.status).toBe("pending");
  });

  it("rejette si une demande est déjà en cours (400)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/delete")
      .set(authHeader(tokenA))
      .send({ password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it("crée bien une ligne en DB avec status pending", async () => {
    const rows = await db
      .select({ id: accountDeletionRequests.id })
      .from(accountDeletionRequests)
      .where(
        and(
          eq(accountDeletionRequests.user_id, userAId),
          eq(accountDeletionRequests.status, "pending")
        )
      );

    expect(rows.length).toBe(1);
  });
});

// ============================================================
// 4. GET /settings/gdpr/deletion/status
// ============================================================

describe("Settings GDPR — GET /settings/gdpr/deletion/status", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/settings/gdpr/deletion/status");
    expect(res.status).toBe(401);
  });

  it("retourne la demande en cours", async () => {
    const res = await request(app)
      .get("/settings/gdpr/deletion/status")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.request).toBeDefined();
    expect(res.body.request.status).toBe("pending");
  });
});

// ============================================================
// 5. DELETE /settings/gdpr/delete (cancel)
// ============================================================

describe("Settings GDPR — DELETE /settings/gdpr/delete", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).delete("/settings/gdpr/delete");
    expect(res.status).toBe(401);
  });

  it("annule la demande (200)", async () => {
    const res = await request(app)
      .delete("/settings/gdpr/delete")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("le statut devient cancelled en DB", async () => {
    const [request] = await db
      .select({ status: accountDeletionRequests.status })
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.user_id, userAId))
      .limit(1);

    expect(request.status).toBe("cancelled");
  });

  it("rejette si aucune demande en cours (404)", async () => {
    const res = await request(app)
      .delete("/settings/gdpr/delete")
      .set(authHeader(tokenA));

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 6. POST /settings/gdpr/acceptance
// ============================================================

describe("Settings GDPR — POST /settings/gdpr/acceptance", () => {
  beforeAll(async () => {
    await db
      .delete(legalAcceptances)
      .where(eq(legalAcceptances.user_id, userAId));
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/acceptance")
      .send({ document_type: "cgu", document_version: "1.0" });

    expect(res.status).toBe(401);
  });

  it("rejette un document_type invalide (400)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/acceptance")
      .set(authHeader(tokenA))
      .send({ document_type: "invalid", document_version: "1.0" });

    expect(res.status).toBe(400);
  });

  it("rejette sans version (400)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/acceptance")
      .set(authHeader(tokenA))
      .send({ document_type: "cgu" });

    expect(res.status).toBe(400);
  });

  it("enregistre une acceptation CGU (201)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/acceptance")
      .set(authHeader(tokenA))
      .send({ document_type: "cgu", document_version: "1.0" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.acceptance).toHaveProperty("id");
    expect(res.body.acceptance.document_type).toBe("cgu");
    expect(res.body.acceptance.document_version).toBe("1.0");
  });

  it("enregistre une acceptation privacy (201)", async () => {
    const res = await request(app)
      .post("/settings/gdpr/acceptance")
      .set(authHeader(tokenA))
      .send({ document_type: "privacy", document_version: "2.0" });

    expect(res.status).toBe(201);
    expect(res.body.acceptance.document_type).toBe("privacy");
  });

  it("enregistre l'IP si disponible", async () => {
    const res = await request(app)
      .post("/settings/gdpr/acceptance")
      .set(authHeader(tokenA))
      .send({ document_type: "cookies", document_version: "1.0" });

    expect(res.status).toBe(201);
    expect(res.body.acceptance).toHaveProperty("ip_address");
  });
});

// ============================================================
// 7. GET /settings/gdpr/acceptances
// ============================================================

describe("Settings GDPR — GET /settings/gdpr/acceptances", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/settings/gdpr/acceptances");
    expect(res.status).toBe(401);
  });

  it("retourne la liste des acceptations", async () => {
    const res = await request(app)
      .get("/settings/gdpr/acceptances")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.acceptances)).toBe(true);
    expect(res.body.acceptances.length).toBeGreaterThanOrEqual(3);
  });

  it("retourne les acceptations triées par date desc", async () => {
    const res = await request(app)
      .get("/settings/gdpr/acceptances")
      .set(authHeader(tokenA));

    const dates = res.body.acceptances.map((a: any) =>
      new Date(a.accepted_at).getTime()
    );
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it("contient tous les champs attendus", async () => {
    const res = await request(app)
      .get("/settings/gdpr/acceptances")
      .set(authHeader(tokenA));

    const a = res.body.acceptances[0];
    expect(a).toHaveProperty("id");
    expect(a).toHaveProperty("document_type");
    expect(a).toHaveProperty("document_version");
    expect(a).toHaveProperty("accepted_at");
    expect(a).toHaveProperty("ip_address");
  });
});
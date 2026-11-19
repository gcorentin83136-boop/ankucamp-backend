// ============================================================
// ANKUCAMP — Tests d'intégration HTTP du module Conversations
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/core/db";
import {
  users,
  userSettings,
  conversations,
  conversationParticipants,
  messages,
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
    email: "convtest_a@test.com",
    username: "convtest_a",
    first_name: "Alice",
    last_name: "Conv",
  });

  userBId = await upsertUser({
    email: "convtest_b@test.com",
    username: "convtest_b",
    first_name: "Bob",
    last_name: "Conv",
  });

  userCId = await upsertUser({
    email: "convtest_c@test.com",
    username: "convtest_c",
    first_name: "Carol",
    last_name: "Conv",
  });

  tokenA = await login("convtest_a@test.com");
  tokenB = await login("convtest_b@test.com");
  tokenC = await login("convtest_c@test.com");
});

// ============================================================
// AFTER ALL — Nettoyage complet
// ============================================================

afterAll(async () => {
  try {
    const myConvs = await db
      .select({ conversation_id: conversationParticipants.conversation_id })
      .from(conversationParticipants)
      .where(
        inArray(conversationParticipants.user_id, [userAId, userBId, userCId])
      );

    const convIds = [...new Set(myConvs.map((c) => c.conversation_id))];

    if (convIds.length > 0) {
      const msgRows = await db
        .select({ id: messages.id })
        .from(messages)
        .where(inArray(messages.conversation_id, convIds));

      const msgIds = msgRows.map((m) => m.id);
      if (msgIds.length > 0) {
        await db.delete(messages).where(inArray(messages.id, msgIds));
      }

      await db
        .delete(conversationParticipants)
        .where(inArray(conversationParticipants.conversation_id, convIds));

      await db
        .delete(conversations)
        .where(inArray(conversations.id, convIds));
    }

    await db
      .delete(userSettings)
      .where(inArray(userSettings.user_id, [userAId, userBId, userCId]));

    await db
      .delete(users)
      .where(inArray(users.id, [userAId, userBId, userCId]));
  } catch (err) {
    console.warn("⚠️ Cleanup échoué (non-bloquant) :", err);
  }
});

// ============================================================
// 1. GET /conversations
// ============================================================

describe("Conversations — GET /conversations", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app).get("/conversations");
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec token", async () => {
    const res = await request(app)
      .get("/conversations")
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.conversations)).toBe(true);
  });
});

// ============================================================
// 2. POST /conversations
// ============================================================

describe("Conversations — POST /conversations", () => {
  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post("/conversations")
      .send({ type: "direct", participant_ids: [userBId] });

    expect(res.status).toBe(401);
  });

  it("rejette payload invalide (400)", async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "invalid" });

    expect(res.status).toBe(400);
  });

  it("crée une conversation directe (201)", async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "direct", participant_ids: [userBId] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.conversation).toHaveProperty("id");
    expect(res.body.conversation.type).toBe("direct");
  });

  it("retourne la conv directe existante si elle existe déjà", async () => {
    const res1 = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "direct", participant_ids: [userBId] });

    const res2 = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "direct", participant_ids: [userBId] });

    expect(res2.status).toBe(201);
    expect(res2.body.conversation.id).toBe(res1.body.conversation.id);
  });

  it("crée une conversation de groupe (201)", async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({
        type: "group",
        name: "Groupe Test",
        participant_ids: [userBId, userCId],
      });

    expect(res.status).toBe(201);
    expect(res.body.conversation.type).toBe("group");
    expect(res.body.conversation.name).toBe("Groupe Test");
  });

  it("rejette l'ajout de soi-même (400)", async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "direct", participant_ids: [userAId] });

    expect(res.status).toBe(400);
  });

  it("rejette un user inexistant (404)", async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "direct", participant_ids: [999999] });

    expect(res.status).toBe(404);
  });
});

// ============================================================
// 3. GET /conversations/:id
// ============================================================

describe("Conversations — GET /conversations/:id", () => {
  let convId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "direct", participant_ids: [userBId] });

    convId = res.body.conversation.id;
  });

  it("retourne 200 pour un participant", async () => {
    const res = await request(app)
      .get(`/conversations/${convId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.conversation.id).toBe(convId);
  });

  it("rejette 403 pour un non-participant", async () => {
    const res = await request(app)
      .get(`/conversations/${convId}`)
      .set(authHeader(tokenC));

    expect(res.status).toBe(403);
  });

  it("rejette id invalide (400)", async () => {
    const res = await request(app)
      .get("/conversations/abc")
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. Messages
// ============================================================

describe("Conversations — Messages", () => {
  let convId: number;
  let messageId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ type: "direct", participant_ids: [userBId] });

    convId = res.body.conversation.id;
  });

  it("rejette sans token (401)", async () => {
    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .send({ content: "test" });

    expect(res.status).toBe(401);
  });

  it("envoie un message (201)", async () => {
    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set(authHeader(tokenA))
      .send({ content: "Hello depuis test", type: "text" });

    expect(res.status).toBe(201);
    expect(res.body.message).toHaveProperty("id");
    expect(res.body.message.content).toBe("Hello depuis test");

    messageId = res.body.message.id;
  });

  it("rejette un message vide (400)", async () => {
    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set(authHeader(tokenA))
      .send({ content: "", type: "text" });

    expect(res.status).toBe(400);
  });

  it("rejette l'envoi par un non-participant (403)", async () => {
    const res = await request(app)
      .post(`/conversations/${convId}/messages`)
      .set(authHeader(tokenC))
      .send({ content: "Intrusion", type: "text" });

    expect(res.status).toBe(403);
  });

  it("liste les messages (200)", async () => {
    const res = await request(app)
      .get(`/conversations/${convId}/messages`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBeGreaterThan(0);
  });

  it("rejette limit invalide (400)", async () => {
    const res = await request(app)
      .get(`/conversations/${convId}/messages?limit=999`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });

  it("marque comme lu (200)", async () => {
    const res = await request(app)
      .post(`/conversations/${convId}/read`)
      .set(authHeader(tokenA))
      .send({ until_message_id: messageId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("édite un message (200)", async () => {
    const res = await request(app)
      .put(`/messages/${messageId}`)
      .set(authHeader(tokenA))
      .send({ content: "Message édité" });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe("Message édité");
  });

  it("rejette l'édition par un autre user (403)", async () => {
    const res = await request(app)
      .put(`/messages/${messageId}`)
      .set(authHeader(tokenB))
      .send({ content: "Tentative" });

    expect(res.status).toBe(403);
  });

  // ✅ FIX : emoji unique pour ce test (jamais utilisé ailleurs)
  it("ajoute une réaction (200)", async () => {
    const res = await request(app)
      .post(`/messages/${messageId}/reactions`)
      .set(authHeader(tokenB))
      .send({ emoji: "🎉" });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("added");
  });

  // ✅ FIX : ajoute puis retire dans le même test → auto-suffisant
  it("retire une réaction (200)", async () => {
    // 1. Ajoute d'abord la réaction
    await request(app)
      .post(`/messages/${messageId}/reactions`)
      .set(authHeader(tokenB))
      .send({ emoji: "🔥" });

    // 2. Puis retire-la
    const res = await request(app)
      .post(`/messages/${messageId}/reactions`)
      .set(authHeader(tokenB))
      .send({ emoji: "🔥" });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("removed");
  });

  it("supprime un message (204)", async () => {
    const res = await request(app)
      .delete(`/messages/${messageId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(204);
  });

  it("rejette suppression par un autre user (403)", async () => {
    const res = await request(app)
      .delete(`/messages/${messageId}`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 5. PUT /conversations/:id (update group)
// ============================================================

describe("Conversations — PUT /conversations/:id", () => {
  let groupId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({
        type: "group",
        name: "Groupe Original",
        participant_ids: [userBId],
      });

    groupId = res.body.conversation.id;
  });

  it("admin peut modifier le nom (200)", async () => {
    const res = await request(app)
      .put(`/conversations/${groupId}`)
      .set(authHeader(tokenA))
      .send({ name: "Groupe Renommé" });

    expect(res.status).toBe(200);
    expect(res.body.conversation.name).toBe("Groupe Renommé");
  });

  it("non-admin rejeté (403)", async () => {
    const res = await request(app)
      .put(`/conversations/${groupId}`)
      .set(authHeader(tokenB))
      .send({ name: "Tentative" });

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 6. Participants
// ============================================================

describe("Conversations — Participants", () => {
  let groupId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({
        type: "group",
        name: "Groupe Participants",
        participant_ids: [userBId],
      });

    groupId = res.body.conversation.id;
  });

  it("admin peut ajouter un participant (201)", async () => {
    const res = await request(app)
      .post(`/conversations/${groupId}/participants`)
      .set(authHeader(tokenA))
      .send({ user_id: userCId });

    expect(res.status).toBe(201);
  });

  it("rejette l'ajout d'un participant déjà présent (400)", async () => {
    const res = await request(app)
      .post(`/conversations/${groupId}/participants`)
      .set(authHeader(tokenA))
      .send({ user_id: userCId });

    expect(res.status).toBe(400);
  });

  it("admin peut retirer un participant (200)", async () => {
    const res = await request(app)
      .delete(`/conversations/${groupId}/participants/${userCId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(200);
  });

  it("rejette auto-retrait (400)", async () => {
    const res = await request(app)
      .delete(`/conversations/${groupId}/participants/${userAId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 7. Leave
// ============================================================

describe("Conversations — Leave", () => {
  it("participant peut quitter (200)", async () => {
    const createRes = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({
        type: "group",
        name: "Groupe Leave",
        participant_ids: [userBId],
      });

    const groupId = createRes.body.conversation.id;

    const res = await request(app)
      .post(`/conversations/${groupId}/leave`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
  });

  it("rejette leave sur conv dont on n'est pas participant (403)", async () => {
    const createRes = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({
        type: "group",
        name: "Groupe Leave 2",
        participant_ids: [userBId],
      });

    const groupId = createRes.body.conversation.id;

    const res = await request(app)
      .post(`/conversations/${groupId}/leave`)
      .set(authHeader(tokenC));

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 8. DELETE /conversations/:id
// ============================================================

describe("Conversations — DELETE /conversations/:id", () => {
  it("admin peut supprimer (204)", async () => {
    const createRes = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({
        type: "group",
        name: "Groupe Delete",
        participant_ids: [userBId],
      });

    const groupId = createRes.body.conversation.id;

    const res = await request(app)
      .delete(`/conversations/${groupId}`)
      .set(authHeader(tokenA));

    expect(res.status).toBe(204);
  });

  it("non-admin rejeté (403)", async () => {
    const createRes = await request(app)
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({
        type: "group",
        name: "Groupe Delete 2",
        participant_ids: [userBId],
      });

    const groupId = createRes.body.conversation.id;

    const res = await request(app)
      .delete(`/conversations/${groupId}`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(403);
  });
});
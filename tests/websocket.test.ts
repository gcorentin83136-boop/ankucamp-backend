// ============================================================
// ANKUCAMP — Tests d'intégration WebSocket (messagerie v2)
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, Server as HttpServer } from "http";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import app from "../src/app";
import { initWebSocket } from "../src/core/websocket/websocket.server";
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

let httpServer: HttpServer | undefined;
let port: number;
let baseUrl: string;

let tokenA: string;
let tokenB: string;
let userAId: number;
let userBId: number;

let socketA: Socket;
let socketB: Socket;

let conversationId: number;

// ============================================================
// HELPERS
// ============================================================

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Timeout connexion WS"));
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(new Error(`Erreur WS : ${err.message}`));
    });
  });
}

function waitForEvent<T = any>(
  socket: Socket,
  event: string,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout event "${event}"`));
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function expectNoEvent(
  socket: Socket,
  event: string,
  timeoutMs = 800
): Promise<boolean> {
  return new Promise((resolve) => {
    const handler = () => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(false);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, timeoutMs);
    socket.on(event, handler);
  });
}

// ============================================================
// BEFORE ALL — Setup serveur + seed
// ============================================================

beforeAll(async () => {
  // 1. Crée 2 users de test (upsert robuste)
  const hash = await bcrypt.hash(PASSWORD, 10);

  const upsertUser = async (opts: {
    email: string;
    username: string;
    first_name: string;
    last_name: string;
  }): Promise<number> => {
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

    // ✅ FIX : upsert userSettings avec onConflictDoNothing
    await db
      .insert(userSettings)
      .values({
        user_id: userId,
        search_indexable: 1,
      })
      .onConflictDoNothing({ target: userSettings.user_id });

    return userId;
  };

  userAId = await upsertUser({
    email: "wstest_a@test.com",
    username: "wstest_a",
    first_name: "Alice",
    last_name: "WS",
  });

  userBId = await upsertUser({
    email: "wstest_b@test.com",
    username: "wstest_b",
    first_name: "Bob",
    last_name: "WS",
  });

  // 2. Démarre un serveur HTTP isolé
  httpServer = createServer(app);
  initWebSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer!.listen(0, () => {
      const addr = httpServer!.address();
      if (typeof addr === "object" && addr) {
        port = addr.port;
        baseUrl = `http://localhost:${port}`;
      }
      resolve();
    });
  });

  // 3. Login HTTP pour récupérer les tokens
  const loginA = await request(app)
    .post("/auth/login")
    .send({ email: "wstest_a@test.com", password: PASSWORD });

  const loginB = await request(app)
    .post("/auth/login")
    .send({ email: "wstest_b@test.com", password: PASSWORD });

  tokenA = loginA.body.token;
  tokenB = loginB.body.token;

  if (!tokenA || !tokenB) {
    throw new Error("Login échoué pour les users WS");
  }

  // 4. Crée une conversation directe
  const convRes = await request(app)
    .post("/conversations")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ type: "direct", participant_ids: [userBId] });

  conversationId = convRes.body.conversation.id;
});

// ============================================================
// AFTER ALL — Nettoyage
// ============================================================

afterAll(async () => {
  // Déconnexion sockets (best-effort)
  try {
    if (socketA?.connected) socketA.disconnect();
  } catch {}
  try {
    if (socketB?.connected) socketB.disconnect();
  } catch {}

  // Nettoyage DB (best-effort)
  try {
    if (conversationId) {
      const rows = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversation_id, conversationId));

      const ids = rows.map((r) => r.id);

      if (ids.length > 0) {
        await db.delete(messages).where(inArray(messages.id, ids));
      }

      await db
        .delete(conversationParticipants)
        .where(eq(conversationParticipants.conversation_id, conversationId));

      await db
        .delete(conversations)
        .where(eq(conversations.id, conversationId));
    }
  } catch (err) {
    console.warn("⚠️ Cleanup DB échoué (non-bloquant) :", err);
  }

  // ✅ FIX : garde-fou si beforeAll a throw avant listen()
  if (httpServer) {
    await new Promise<void>((resolve) => {
      try {
        httpServer!.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  // ⚠️ NE PAS appeler pool.end() ici
  // Le pool est partagé entre tous les fichiers de test.
  // Vitest ferme les handles automatiquement en fin de run.
});

// ============================================================
// TESTS
// ============================================================

describe("WebSocket — Auth", () => {
  it("rejette un token invalide", async () => {
    await new Promise<void>((resolve) => {
      const badSocket = io(baseUrl, {
        auth: { token: "invalid.jwt.token" },
        transports: ["websocket"],
        reconnection: false,
      });

      const timer = setTimeout(() => {
        badSocket.disconnect();
        resolve();
      }, 3000);

      badSocket.on("connect", () => {
        clearTimeout(timer);
        badSocket.disconnect();
        throw new Error("Connecté avec token bidon !");
      });

      badSocket.on("connect_error", (err) => {
        clearTimeout(timer);
        badSocket.disconnect();
        expect(err.message).toBe("Token invalide");
        resolve();
      });
    });
  });

  it("rejette une connexion sans token", async () => {
    await new Promise<void>((resolve) => {
      const badSocket = io(baseUrl, {
        transports: ["websocket"],
        reconnection: false,
      });

      const timer = setTimeout(() => {
        badSocket.disconnect();
        resolve();
      }, 3000);

      badSocket.on("connect", () => {
        clearTimeout(timer);
        badSocket.disconnect();
        throw new Error("Connecté sans token !");
      });

      badSocket.on("connect_error", (err) => {
        clearTimeout(timer);
        badSocket.disconnect();
        expect(err.message).toBe("Token manquant");
        resolve();
      });
    });
  });
});

describe("WebSocket — Connexion", () => {
  it("connecte User A avec token valide", async () => {
    socketA = await connectSocket(tokenA);
    expect(socketA.connected).toBe(true);
  });

  it("connecte User B avec token valide", async () => {
    socketB = await connectSocket(tokenB);
    expect(socketB.connected).toBe(true);
  });
});

describe("WebSocket — Conversation", () => {
  it("User A rejoint la room", async () => {
    const joined = waitForEvent(socketA, "conversation:joined");
    socketA.emit("conversation:join", { conversationId });
    const payload = await joined;

    expect(payload.conversationId).toBe(conversationId);
  });

  it("User B rejoint la room", async () => {
    const joined = waitForEvent(socketB, "conversation:joined");
    socketB.emit("conversation:join", { conversationId });
    const payload = await joined;

    expect(payload.conversationId).toBe(conversationId);
  });
});

describe("WebSocket — Message:new", () => {
  let messageId: number;

  it("User B reçoit message:new quand A envoie", async () => {
    const received = waitForEvent(socketB, "message:new");
    socketA.emit("message:send", {
      conversationId,
      content: "Hello depuis test Vitest",
      type: "text",
    });

    const msg = await received;
    messageId = msg.id;

    expect(msg).toHaveProperty("id");
    expect(msg.content).toBe("Hello depuis test Vitest");
    expect(msg.conversation_id).toBe(conversationId);
  });

  it("User A ne reçoit PAS son propre message (pas d'écho)", async () => {
    const noEcho = expectNoEvent(socketA, "message:new", 1000);

    socketA.emit("message:send", {
      conversationId,
      content: "Test no echo",
      type: "text",
    });

    const noEchoReceived = await noEcho;
    expect(noEchoReceived).toBe(true);
  });

  it("User A reçoit message:read quand B marque lu", async () => {
    const readOnA = waitForEvent(socketA, "message:read");
    socketB.emit("message:read", { conversationId, untilMessageId: messageId });

    const payload = await readOnA;
    expect(payload.userId).toBe(userBId);
    expect(payload.conversationId).toBe(conversationId);
  });

  it("User B reçoit message:edited", async () => {
    const edited = waitForEvent(socketB, "message:edited");
    socketA.emit("message:edit", { messageId, content: "Édité via test" });

    const payload = await edited;
    expect(payload.content).toBe("Édité via test");
  });

  it("User B reçoit message:reacted", async () => {
    const reacted = waitForEvent(socketB, "message:reacted");
    socketA.emit("message:react", { messageId, emoji: "👍" });

    const payload = await reacted;
    expect(payload.emoji).toBe("👍");
    expect(payload.action).toBe("added");
  });

  it("User B reçoit typing:user (start)", async () => {
    const typing = waitForEvent(socketB, "typing:user");
    socketA.emit("typing:start", { conversationId });

    const payload = await typing;
    expect(payload.typing).toBe(true);
    expect(payload.userId).toBe(userAId);
  });

  it("User B reçoit typing:user (stop)", async () => {
    const typing = waitForEvent(socketB, "typing:user");
    socketA.emit("typing:stop", { conversationId });

    const payload = await typing;
    expect(payload.typing).toBe(false);
  });

  it("User B reçoit message:deleted", async () => {
    const deleted = waitForEvent(socketB, "message:deleted");
    socketA.emit("message:delete", { messageId });

    const payload = await deleted;
    expect(payload.messageId).toBe(messageId);
  });
});
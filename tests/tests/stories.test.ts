import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { db } from "../../src/core/db";
import { users, userSettings, stories, storyReactions, notifications } from "../../src/core/db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

const PASSWORD = "Test1234!";

let userAId: number;
let userBId: number;
let tokenA: string;
let tokenB: string;

async function upsertUser(opts: any): Promise<number> {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, opts.email)).limit(1);
  let userId: number;
  if (existing) {
    await db.update(users).set({ password_hash: hash, email_verified: 1 }).where(eq(users.id, existing.id));
    userId = existing.id;
  } else {
    const [created] = await db.insert(users).values({
      first_name: opts.first_name, last_name: opts.last_name, username: opts.username,
      email: opts.email, role: "particulier", email_verified: 1, password_hash: hash,
    }).returning();
    userId = created.id;
  }
  await db.insert(userSettings).values({ user_id: userId, search_indexable: 1 }).onConflictDoNothing();
  return userId;
}

async function login(email: string): Promise<string> {
  const res = await request(app).post("/auth/login").send({ email, password: PASSWORD });
  return res.body.token;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  userAId = await upsertUser({ email: "storytest_a@test.com", username: "storytest_a", first_name: "Alice", last_name: "Story" });
  userBId = await upsertUser({ email: "storytest_b@test.com", username: "storytest_b", first_name: "Bob", last_name: "Story" });
  tokenA = await login("storytest_a@test.com");
  tokenB = await login("storytest_b@test.com");
});

afterAll(async () => {
  const ids = [userAId, userBId];
  await db.delete(storyReactions).where(inArray(storyReactions.user_id, ids));
  await db.delete(stories).where(inArray(stories.author_id, ids));
  await db.delete(notifications).where(inArray(notifications.user_id, ids));
  await db.delete(userSettings).where(inArray(userSettings.user_id, ids));
  await db.delete(users).where(inArray(users.id, ids));
});

describe("Stories — Création et Notifications", () => {
  it("crée une story et notifie les utilisateurs tagués", async () => {
    const elements = JSON.stringify([
      { id: "1", type: "mention", content: "@storytest_b", x: 50, y: 50 }
    ]);

    const res = await request(app)
      .post("/stories")
      .set(authHeader(tokenA))
      .send({
        media_url: "http://example.com/video.mp4",
        media_type: "video",
        elements: elements,
      });

    expect(res.status).toBe(201);
    expect(res.body.story).toHaveProperty("id");

    // Vérifier que la notification a été créée pour userB
    const notifs = await db.select().from(notifications).where(eq(notifications.user_id, userBId));
    expect(notifs.some(n => n.content.includes("t'a tagué"))).toBe(true);
  });
});

describe("Stories — Réactions", () => {
  let storyId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/stories")
      .set(authHeader(tokenA))
      .send({ media_url: "http://example.com/video.mp4", media_type: "video" });
    storyId = res.body.story.id;
  });

  it("permet de réagir et notifie le créateur", async () => {
    const res = await request(app)
      .post(`/stories/${storyId}/react`)
      .set(authHeader(tokenB))
      .send({ emoji: "🔥" });

    expect(res.status).toBe(200);
    expect(res.body.reacted).toBe(true);

    // Vérifier la notif pour userA
    const notifs = await db.select().from(notifications).where(eq(notifications.user_id, userAId));
    expect(notifs.some(n => n.content.includes("a réagi"))).toBe(true);
  });

  it("permet de retirer sa réaction", async () => {
    const res = await request(app)
      .post(`/stories/${storyId}/react`)
      .set(authHeader(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.reacted).toBe(false);
  });
});
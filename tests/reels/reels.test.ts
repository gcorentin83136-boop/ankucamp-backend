import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { db } from "../../src/core/db";
import {
  users,
  reels,
  reelLikes,
  posts,
  userSessions,
} from "../../src/core/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env";
import { hashToken } from "../../src/core/api/settings/sessions/sessions.service";

describe("Reels (Anku Live) API", () => {
  let testUser: any;
  let authToken: string;
  let testReelId: number;

  beforeAll(async () => {
    // 1. Créer un utilisateur de test
    const [user] = await db
      .insert(users)
      .values({
        email: `reel-test-${Date.now()}@anku.com`,
        first_name: "Reel",
        last_name: "Tester",
        username: `reeltester_${Date.now()}`,
        role: "particulier",
        provider: "local",
        email_verified: 1,
      })
      .returning();
    testUser = user;

    // 2. Générer le JWT
    authToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3. 🆕 CRÉER LA SESSION EN BDD (sinon le middleware refuse)
    await db.insert(userSessions).values({
      user_id: user.id,
      token_hash: hashToken(authToken),
      expires_at: new Date(Date.now() + 60 * 60 * 1000), // +1h
      device_info: "Vitest Test Runner",
      ip_address: "127.0.0.1",
    });
  });

  afterAll(async () => {
    try {
      // Nettoyer dans l'ordre (FK)
      await db.delete(reelLikes).where(eq(reelLikes.user_id, testUser.id));
      await db.delete(reels).where(eq(reels.author_id, testUser.id));
      await db.delete(posts).where(eq(posts.author_id, testUser.id));
      await db.delete(userSessions).where(eq(userSessions.user_id, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
    } catch (error) {
      console.error("Erreur lors du nettoyage de la base de test:", error);
    }
  });

  // ============================================================
  // CRÉATION
  // ============================================================
  describe("POST /reels", () => {
    it("devrait créer un Reel vidéo avec succès", async () => {
      const res = await request(app)
        .post("/reels")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          media_url: "https://res.cloudinary.com/demo/video/upload/v123/reel.mp4",
          media_type: "video",
          caption: "Mon premier Anku Live !",
          visibility: "public",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.reel.caption).toBe("Mon premier Anku Live !");
      expect(res.body.reel.media_type).toBe("video");

      testReelId = res.body.reel.id;
    });

    it("devrait créer un Reel image avec succès", async () => {
      const res = await request(app)
        .post("/reels")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          media_url: "https://res.cloudinary.com/demo/image/upload/v123/photo.jpg",
          media_type: "image",
          caption: "Une photo sympa",
        });

      expect(res.status).toBe(201);
      expect(res.body.reel.media_type).toBe("image");
    });

    it("devrait échouer si le média est manquant", async () => {
      const res = await request(app)
        .post("/reels")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ caption: "Pas de média" });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ============================================================
  // LECTURE
  // ============================================================
  describe("GET /reels", () => {
    it("devrait récupérer le feed des Reels", async () => {
      const res = await request(app)
        .get("/reels")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.reels)).toBe(true);
      expect(res.body.reels.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // LIKES
  // ============================================================
  describe("POST /reels/:id/like", () => {
    it("devrait liker un Reel", async () => {
      const res = await request(app)
        .post(`/reels/${testReelId}/like`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.liked).toBe(true);
    });

    it("devrait retirer le like d'un Reel", async () => {
      const res = await request(app)
        .post(`/reels/${testReelId}/like`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(false);
    });
  });

  // ============================================================
  // PARTAGE DANS LE FEED
  // ============================================================
  describe("POST /posts/share-reel/:reelId", () => {
    it("devrait partager un Reel sur le feed (créer un post)", async () => {
      const res = await request(app)
        .post(`/posts/share-reel/${testReelId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          share_comment: "Regardez cet Anku Live incroyable !",
          visibility: "public",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.post.shared_reel_id).toBe(testReelId);
      expect(res.body.post.content).toBe("Regardez cet Anku Live incroyable !");
      expect(res.body.post.shared_reel).toBeDefined();
      expect(res.body.post.shared_reel.id).toBe(testReelId);
    });
  });
});
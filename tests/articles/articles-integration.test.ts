import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser } from "../helpers/factories";

describe("Articles integration", () => {
  const VALID_CONTENT =
    "Ceci est un contenu de test suffisamment long pour passer la validation de vingt caractères minimum.";

  // ============================================================
  // LECTURE PUBLIQUE
  // ============================================================

  describe("GET /articles", () => {
    it("retourne tableau vide au départ", async () => {
      const res = await request(app).get("/articles");
      expect(res.status).toBe(200);
      expect(res.body.articles).toEqual([]);
    });

    it("liste les articles publiés", async () => {
      const user = await createUser({ email: "art1@test.com" });

      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Les bienfaits du compost",
          content: VALID_CONTENT,
          category: "conseil",
        });
      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Recette de soupe",
          content: VALID_CONTENT,
          category: "recette",
        });

      const res = await request(app).get("/articles");
      expect(res.body.articles).toHaveLength(2);
    });

    it("filtre par category", async () => {
      const user = await createUser({ email: "art2@test.com" });

      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Conseil jardin",
          content: VALID_CONTENT,
          category: "conseil",
        });
      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Recette facile",
          content: VALID_CONTENT,
          category: "recette",
        });

      const res = await request(app).get("/articles?category=recette");
      expect(res.body.articles).toHaveLength(1);
      expect(res.body.articles[0].category).toBe("recette");
    });

    it("filtre par tag", async () => {
      const user = await createUser({ email: "art3@test.com" });

      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Avec tag",
          content: VALID_CONTENT,
          category: "conseil",
          tags: ["compost", "jardin"],
        });
      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Sans tag",
          content: VALID_CONTENT,
          category: "conseil",
        });

      const res = await request(app).get("/articles?tag=compost");
      expect(res.body.articles).toHaveLength(1);
      expect(res.body.articles[0].title).toBe("Avec tag");
    });
  });

  describe("GET /articles/:slug", () => {
    it("retourne l'article par slug + incrémente views", async () => {
      const user = await createUser({ email: "art4@test.com" });

      const createRes = await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Mon super article",
          content: VALID_CONTENT,
          category: "conseil",
        });

      const slug = createRes.body.article.slug;

      const res = await request(app).get(`/articles/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.article.slug).toBe(slug);
      expect(res.body.article.views_count).toBe(1);

      // 2ᵉ fetch → 2 vues
      const res2 = await request(app).get(`/articles/${slug}`);
      expect(res2.body.article.views_count).toBe(2);
    });

    it("404 si slug inexistant", async () => {
      const res = await request(app).get("/articles/does-not-exist");
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // CRÉATION
  // ============================================================

  describe("POST /articles", () => {
    it("crée un article (201) + slug auto", async () => {
      const user = await createUser({ email: "art5@test.com" });

      const res = await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Les bienfaits du compost",
          content: VALID_CONTENT,
          category: "conseil",
          tags: ["compost"],
        });

      expect(res.status).toBe(201);
      expect(res.body.article.slug).toBe("les-bienfaits-du-compost");
      expect(res.body.article.tags).toEqual(["compost"]);
    });

    it("slug unique même avec titre identique", async () => {
      const user = await createUser({ email: "art6@test.com" });

      const res1 = await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Même titre",
          content: VALID_CONTENT,
          category: "conseil",
        });
      const res2 = await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Même titre",
          content: VALID_CONTENT,
          category: "conseil",
        });

      expect(res1.body.article.slug).toBe("meme-titre");
      expect(res2.body.article.slug).toBe("meme-titre-1");
    });

    it("refuse si non authentifié (401)", async () => {
      const res = await request(app)
        .post("/articles")
        .send({
          title: "Hack",
          content: VALID_CONTENT,
          category: "conseil",
        });
      expect(res.status).toBe(401);
    });

    it("refuse si contenu trop court (400)", async () => {
      const user = await createUser({ email: "art7@test.com" });

      const res = await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Titre valide",
          content: "court",
          category: "conseil",
        });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // UPDATE
  // ============================================================

  describe("PUT /articles/:id", () => {
    it("modifie son article (200) + régénère slug", async () => {
      const user = await createUser({ email: "art8@test.com" });

      const createRes = await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Ancien titre",
          content: VALID_CONTENT,
          category: "conseil",
        });

      const res = await request(app)
        .put(`/articles/${createRes.body.article.id}`)
        .set("Authorization", user.authorization)
        .send({ title: "Nouveau titre" });

      expect(res.status).toBe(200);
      expect(res.body.article.slug).toBe("nouveau-titre");
    });

    it("refuse de modifier l'article d'un autre (403)", async () => {
      const owner = await createUser({ email: "art9-owner@test.com" });
      const other = await createUser({ email: "art9-other@test.com" });

      const createRes = await request(app)
        .post("/articles")
        .set("Authorization", owner.authorization)
        .send({
          title: "Article owner",
          content: VALID_CONTENT,
          category: "conseil",
        });

      const res = await request(app)
        .put(`/articles/${createRes.body.article.id}`)
        .set("Authorization", other.authorization)
        .send({ title: "Hack" });

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // DELETE
  // ============================================================

  describe("DELETE /articles/:id", () => {
    it("supprime son article (204)", async () => {
      const user = await createUser({ email: "art10@test.com" });

      const createRes = await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "À supprimer",
          content: VALID_CONTENT,
          category: "conseil",
        });

      const res = await request(app)
        .delete(`/articles/${createRes.body.article.id}`)
        .set("Authorization", user.authorization);

      expect(res.status).toBe(204);
    });
  });

  // ============================================================
  // LIKE (toggle)
  // ============================================================

  describe("POST /articles/:id/like", () => {
    it("like un article (liked: true)", async () => {
      const author = await createUser({ email: "art11@test.com" });
      const user = await createUser({ email: "art11-liker@test.com" });

      const createRes = await request(app)
        .post("/articles")
        .set("Authorization", author.authorization)
        .send({
          title: "À liker",
          content: VALID_CONTENT,
          category: "conseil",
        });

      const res = await request(app)
        .post(`/articles/${createRes.body.article.id}/like`)
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(true);
    });

    it("toggle : unlike au 2ᵉ appel", async () => {
      const author = await createUser({ email: "art12@test.com" });
      const user = await createUser({ email: "art12-liker@test.com" });

      const createRes = await request(app)
        .post("/articles")
        .set("Authorization", author.authorization)
        .send({
          title: "À liker",
          content: VALID_CONTENT,
          category: "conseil",
        });

      const articleId = createRes.body.article.id;

      await request(app)
        .post(`/articles/${articleId}/like`)
        .set("Authorization", user.authorization);

      const res = await request(app)
        .post(`/articles/${articleId}/like`)
        .set("Authorization", user.authorization);

      expect(res.body.liked).toBe(false);
    });
  });

  // ============================================================
  // MES ARTICLES
  // ============================================================

  describe("GET /articles/me", () => {
    it("liste mes articles (y compris draft)", async () => {
      const user = await createUser({ email: "art13@test.com" });

      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Publié",
          content: VALID_CONTENT,
          category: "conseil",
          status: "published",
        });
      await request(app)
        .post("/articles")
        .set("Authorization", user.authorization)
        .send({
          title: "Brouillon",
          content: VALID_CONTENT,
          category: "conseil",
          status: "draft",
        });

      const res = await request(app)
        .get("/articles/me")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.articles).toHaveLength(2);
    });
  });
});
import { describe, it, expect } from "vitest";
import {
  createArticleSchema,
  updateArticleSchema,
  listArticlesQuerySchema,
  ARTICLE_CATEGORIES,
  ARTICLE_STATUSES,
} from "../../src/core/api/articles/articles.validation";

describe("articles validation", () => {
  describe("createArticleSchema", () => {
    const valid = {
      title: "Les bienfaits du compost",
      content: "Le compost est un excellent engrais naturel pour votre jardin.",
      category: "conseil" as const,
    };

    it("accepte un article valide minimal", () => {
      const r = createArticleSchema.safeParse(valid);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.status).toBe("published");
        expect(r.data.tags).toEqual([]);
      }
    });

    it("accepte avec tous les champs", () => {
      const r = createArticleSchema.safeParse({
        ...valid,
        excerpt: "Un résumé court",
        cover_url: "https://example.com/cover.jpg",
        tags: ["compost", "jardin", "bio"],
      });
      expect(r.success).toBe(true);
    });

    it("refuse catégorie inconnue", () => {
      const r = createArticleSchema.safeParse({ ...valid, category: "banana" });
      expect(r.success).toBe(false);
    });

    it("refuse titre trop court", () => {
      const r = createArticleSchema.safeParse({ ...valid, title: "ab" });
      expect(r.success).toBe(false);
    });

    it("refuse contenu trop court", () => {
      const r = createArticleSchema.safeParse({ ...valid, content: "court" });
      expect(r.success).toBe(false);
    });

    it("refuse plus de 10 tags", () => {
      const r = createArticleSchema.safeParse({
        ...valid,
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("updateArticleSchema", () => {
    it("accepte objet vide", () => {
      const r = updateArticleSchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepte status=archived", () => {
      const r = updateArticleSchema.safeParse({ status: "archived" });
      expect(r.success).toBe(true);
    });
  });

  describe("listArticlesQuerySchema", () => {
    it("applique les defaults", () => {
      const r = listArticlesQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.category).toBe("all");
        expect(r.data.sort).toBe("recent");
        expect(r.data.limit).toBe(20);
      }
    });

    it("accepte category=recette", () => {
      const r = listArticlesQuerySchema.safeParse({ category: "recette" });
      expect(r.success).toBe(true);
    });

    it("accepte sort=popular", () => {
      const r = listArticlesQuerySchema.safeParse({ sort: "popular" });
      expect(r.success).toBe(true);
    });
  });

  describe("constantes", () => {
    it("5 catégories", () => {
      expect(ARTICLE_CATEGORIES.length).toBe(5);
    });
    it("3 statuts", () => {
      expect(ARTICLE_STATUSES.length).toBe(3);
    });
  });
});
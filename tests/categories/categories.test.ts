import { describe, it, expect } from "vitest";
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
} from "../../src/core/api/categories/categories.validation";

describe("categories validation", () => {
  describe("createCategorySchema", () => {
    it("accepte une catégorie valide", () => {
      const r = createCategorySchema.safeParse({
        name: "Fruits",
        slug: "fruits",
      });
      expect(r.success).toBe(true);
    });

    it("accepte avec icon + image", () => {
      const r = createCategorySchema.safeParse({
        name: "Légumes",
        slug: "legumes",
        icon: "🥕",
        image_url: "https://example.com/legumes.jpg",
      });
      expect(r.success).toBe(true);
    });

    it("refuse slug avec majuscules", () => {
      const r = createCategorySchema.safeParse({
        name: "Fruits",
        slug: "Fruits",
      });
      expect(r.success).toBe(false);
    });

    it("refuse slug avec espaces", () => {
      const r = createCategorySchema.safeParse({
        name: "Fruits",
        slug: "fruits secs",
      });
      expect(r.success).toBe(false);
    });

    it("refuse slug avec underscores", () => {
      const r = createCategorySchema.safeParse({
        name: "Fruits",
        slug: "fruits_secs",
      });
      expect(r.success).toBe(false);
    });

    it("accepte slug avec tirets", () => {
      const r = createCategorySchema.safeParse({
        name: "Fruits secs",
        slug: "fruits-secs",
      });
      expect(r.success).toBe(true);
    });

    it("refuse name trop court", () => {
      const r = createCategorySchema.safeParse({ name: "A", slug: "a" });
      expect(r.success).toBe(false);
    });
  });

  describe("updateCategorySchema", () => {
    it("accepte objet vide", () => {
      const r = updateCategorySchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepte juste un name", () => {
      const r = updateCategorySchema.safeParse({ name: "Nouveau nom" });
      expect(r.success).toBe(true);
    });
  });

  describe("listCategoriesQuerySchema", () => {
    it("applique les defaults", () => {
      const r = listCategoriesQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.limit).toBe(100);
        expect(r.data.offset).toBe(0);
      }
    });

    it("accepte q", () => {
      const r = listCategoriesQuerySchema.safeParse({ q: "fruit" });
      expect(r.success).toBe(true);
    });
  });
});
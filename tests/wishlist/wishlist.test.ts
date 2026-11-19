import { describe, it, expect } from "vitest";
import { listWishlistQuerySchema } from "../../src/core/api/wishlist/wishlist.validation";

describe("wishlist validation", () => {
  describe("listWishlistQuerySchema", () => {
    it("applique les defaults", () => {
      const r = listWishlistQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.limit).toBe(50);
        expect(r.data.offset).toBe(0);
      }
    });

    it("accepte limit personnalisé", () => {
      const r = listWishlistQuerySchema.safeParse({ limit: "10" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.limit).toBe(10);
    });

    it("refuse limit > 100", () => {
      const r = listWishlistQuerySchema.safeParse({ limit: "500" });
      expect(r.success).toBe(false);
    });

    it("refuse offset négatif", () => {
      const r = listWishlistQuerySchema.safeParse({ offset: "-5" });
      expect(r.success).toBe(false);
    });

    it("coerce les strings en number", () => {
      const r = listWishlistQuerySchema.safeParse({
        limit: "25",
        offset: "50",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.limit).toBe(25);
        expect(r.data.offset).toBe(50);
      }
    });
  });
});
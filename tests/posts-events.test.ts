import { describe, it, expect } from "vitest";
import { shareEventSchema } from "../src/core/api/posts/posts.validation";

describe("posts-events integration", () => {
  describe("shareEventSchema", () => {
    it("accepte un partage vide (public par défaut)", () => {
      const r = shareEventSchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.visibility).toBe("public");
    });

    it("accepte avec commentaire + visibilité friends", () => {
      const r = shareEventSchema.safeParse({
        share_comment: "Venez nombreux !",
        visibility: "friends",
      });
      expect(r.success).toBe(true);
    });

    it("refuse visibilité inconnue", () => {
      const r = shareEventSchema.safeParse({ visibility: "banana" });
      expect(r.success).toBe(false);
    });

    it("refuse commentaire > 2000 chars", () => {
      const r = shareEventSchema.safeParse({
        share_comment: "x".repeat(2001),
      });
      expect(r.success).toBe(false);
    });
  });
});
import { describe, it, expect } from "vitest";
import {
  createPromoSchema,
  updatePromoSchema,
  validatePromoSchema,
  listPromosQuerySchema,
  PROMO_TYPES,
} from "../../src/core/api/promo/promo.validation";

describe("promo validation", () => {
  describe("createPromoSchema", () => {
    const valid = {
      code: "welcome10",
      type: "percent" as const,
      value: 10,
    };

    it("accepte un code valide minimal", () => {
      const r = createPromoSchema.safeParse(valid);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.code).toBe("WELCOME10");
        expect(r.data.is_active).toBe(true);
        expect(r.data.notify_users).toBe(false);
      }
    });

    it("refuse code vide", () => {
      const r = createPromoSchema.safeParse({ ...valid, code: "" });
      expect(r.success).toBe(false);
    });

    it("refuse code avec espaces", () => {
      const r = createPromoSchema.safeParse({ ...valid, code: "PROMO 10" });
      expect(r.success).toBe(false);
    });

    it("refuse type inconnu", () => {
      const r = createPromoSchema.safeParse({ ...valid, type: "banana" });
      expect(r.success).toBe(false);
    });

    it("refuse value négative", () => {
      const r = createPromoSchema.safeParse({ ...valid, value: -5 });
      expect(r.success).toBe(false);
    });

    it("accepte notify_users = true", () => {
      const r = createPromoSchema.safeParse({ ...valid, notify_users: true });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.notify_users).toBe(true);
    });

    it("accepte max_uses_per_user", () => {
      const r = createPromoSchema.safeParse({
        ...valid,
        max_uses_per_user: 1,
      });
      expect(r.success).toBe(true);
    });

    it("coerce valid_from string en Date", () => {
      const r = createPromoSchema.safeParse({
        ...valid,
        valid_from: "2026-01-01T00:00:00Z",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.valid_from).toBeInstanceOf(Date);
    });
  });

  describe("updatePromoSchema", () => {
    it("accepte objet vide", () => {
      const r = updatePromoSchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepte juste is_active", () => {
      const r = updatePromoSchema.safeParse({ is_active: false });
      expect(r.success).toBe(true);
    });
  });

  describe("validatePromoSchema", () => {
    it("accepte code + subtotal", () => {
      const r = validatePromoSchema.safeParse({
        code: "WELCOME10",
        subtotal: 50,
      });
      expect(r.success).toBe(true);
    });

    it("accepte product_ids", () => {
      const r = validatePromoSchema.safeParse({
        code: "WELCOME10",
        subtotal: 50,
        product_ids: [1, 2, 3],
      });
      expect(r.success).toBe(true);
    });

    it("refuse subtotal négatif", () => {
      const r = validatePromoSchema.safeParse({
        code: "WELCOME10",
        subtotal: -10,
      });
      expect(r.success).toBe(false);
    });

    it("refuse code trop court", () => {
      const r = validatePromoSchema.safeParse({ code: "AB", subtotal: 50 });
      expect(r.success).toBe(false);
    });
  });

  describe("listPromosQuerySchema", () => {
    it("applique les defaults", () => {
      const r = listPromosQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.active_only).toBe(false);
        expect(r.data.limit).toBe(50);
      }
    });

    it("accepte active_only=true (string)", () => {
      const r = listPromosQuerySchema.safeParse({ active_only: "true" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.active_only).toBe(true);
    });
  });

  describe("constantes", () => {
    it("2 types de promo", () => {
      expect(PROMO_TYPES.length).toBe(2);
      expect(PROMO_TYPES).toContain("percent");
      expect(PROMO_TYPES).toContain("fixed");
    });
  });
});
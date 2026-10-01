import { describe, it, expect } from "vitest";
import {
  createReportSchema,
  listReportsQuerySchema,
  resolveReportSchema,
  dismissReportSchema,
  REPORT_TARGET_TYPES,
  REPORT_REASONS,
} from "../../src/core/api/moderation/reports.validation";

describe("reports validation", () => {
  describe("createReportSchema", () => {
    it("accepte un signalement valide", () => {
      const parsed = createReportSchema.safeParse({
        target_type: "post",
        target_id: 42,
        reason: "spam",
      });
      expect(parsed.success).toBe(true);
    });

    it("accepte avec description", () => {
      const parsed = createReportSchema.safeParse({
        target_type: "review",
        target_id: 1,
        reason: "fake",
        description: "Cet avis est faux",
      });
      expect(parsed.success).toBe(true);
    });

    it("refuse un target_type inconnu", () => {
      const parsed = createReportSchema.safeParse({
        target_type: "banana",
        target_id: 1,
        reason: "spam",
      });
      expect(parsed.success).toBe(false);
    });

    it("refuse un reason inconnu", () => {
      const parsed = createReportSchema.safeParse({
        target_type: "post",
        target_id: 1,
        reason: "banana",
      });
      expect(parsed.success).toBe(false);
    });

    it("refuse un target_id negatif", () => {
      const parsed = createReportSchema.safeParse({
        target_type: "post",
        target_id: -1,
        reason: "spam",
      });
      expect(parsed.success).toBe(false);
    });

    it("refuse une description > 1000 chars", () => {
      const parsed = createReportSchema.safeParse({
        target_type: "post",
        target_id: 1,
        reason: "spam",
        description: "x".repeat(1001),
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("listReportsQuerySchema", () => {
    it("applique les defaults", () => {
      const parsed = listReportsQuerySchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe("pending");
        expect(parsed.data.target_type).toBe("all");
        expect(parsed.data.limit).toBe(20);
        expect(parsed.data.offset).toBe(0);
      }
    });

    it("accepte status=all", () => {
      const parsed = listReportsQuerySchema.safeParse({ status: "all" });
      expect(parsed.success).toBe(true);
    });

    it("refuse limit > 100", () => {
      const parsed = listReportsQuerySchema.safeParse({ limit: "500" });
      expect(parsed.success).toBe(false);
    });
  });

  describe("resolveReportSchema", () => {
    it("accepte vide (defaults)", () => {
      const parsed = resolveReportSchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.delete_content).toBe(true);
      }
    });

    it("accepte delete_content=false", () => {
      const parsed = resolveReportSchema.safeParse({
        delete_content: false,
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("dismissReportSchema", () => {
    it("refuse note < 10 chars", () => {
      const parsed = dismissReportSchema.safeParse({ admin_note: "short" });
      expect(parsed.success).toBe(false);
    });

    it("accepte note >= 10 chars", () => {
      const parsed = dismissReportSchema.safeParse({
        admin_note: "Pas de problème détecté ici.",
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("constantes", () => {
    it("contient 7 target_types", () => {
      expect(REPORT_TARGET_TYPES.length).toBe(7);
    });

    it("contient 7 reasons", () => {
      expect(REPORT_REASONS.length).toBe(7);
    });
  });
});
import { describe, it, expect } from "vitest";
import { listAuditLogsQuerySchema } from "../../src/core/api/audit/audit.validation";
import {
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from "../../src/core/api/audit/audit.helper";

describe("audit validation", () => {
  describe("listAuditLogsQuerySchema", () => {
    it("applique les defaults", () => {
      const r = listAuditLogsQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.action).toBe("all");
        expect(r.data.target_type).toBe("all");
        expect(r.data.limit).toBe(50);
        expect(r.data.offset).toBe(0);
      }
    });

    it("accepte un filtre par admin_id", () => {
      const r = listAuditLogsQuerySchema.safeParse({ admin_id: "5" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.admin_id).toBe(5);
    });

    it("accepte un filtre par action", () => {
      const r = listAuditLogsQuerySchema.safeParse({ action: "kyc_approve" });
      expect(r.success).toBe(true);
    });

    it("refuse une action inconnue", () => {
      const r = listAuditLogsQuerySchema.safeParse({ action: "banana" });
      expect(r.success).toBe(false);
    });

    it("accepte un filtre par target_type", () => {
      const r = listAuditLogsQuerySchema.safeParse({ target_type: "user" });
      expect(r.success).toBe(true);
    });

    it("accepte un filtre par target_id", () => {
      const r = listAuditLogsQuerySchema.safeParse({ target_id: "42" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.target_id).toBe(42);
    });

    it("accepte un intervalle from/to", () => {
      const r = listAuditLogsQuerySchema.safeParse({
        from: "2026-01-01T00:00:00Z",
        to: "2026-12-31T23:59:59Z",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.from).toBeInstanceOf(Date);
        expect(r.data.to).toBeInstanceOf(Date);
      }
    });

    it("refuse limit > 100", () => {
      const r = listAuditLogsQuerySchema.safeParse({ limit: "500" });
      expect(r.success).toBe(false);
    });

    it("refuse offset négatif", () => {
      const r = listAuditLogsQuerySchema.safeParse({ offset: "-5" });
      expect(r.success).toBe(false);
    });
  });

  describe("constantes", () => {
    it("18 actions d'audit", () => {
      expect(AUDIT_ACTIONS.length).toBe(18);
      expect(AUDIT_ACTIONS).toContain("kyc_approve");
      expect(AUDIT_ACTIONS).toContain("report_resolve");
      expect(AUDIT_ACTIONS).toContain("badge_grant");
    });

    it("14 types de cibles", () => {
      expect(AUDIT_TARGET_TYPES.length).toBe(14);
      expect(AUDIT_TARGET_TYPES).toContain("user");
      expect(AUDIT_TARGET_TYPES).toContain("kyc");
      expect(AUDIT_TARGET_TYPES).toContain("report");
    });
  });
});
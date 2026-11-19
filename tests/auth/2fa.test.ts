import { describe, it, expect } from "vitest";
import {
  verify2FASetupSchema,
  disable2FASchema,
  validate2FALoginSchema,
} from "../../src/core/api/auth/2fa/2fa.validation";

describe("2FA validation", () => {
  describe("verify2FASetupSchema", () => {
    it("accepte un code à 6 chiffres", () => {
      const r = verify2FASetupSchema.safeParse({ code: "123456" });
      expect(r.success).toBe(true);
    });

    it("refuse un code à 5 chiffres", () => {
      const r = verify2FASetupSchema.safeParse({ code: "12345" });
      expect(r.success).toBe(false);
    });

    it("refuse un code avec lettres", () => {
      const r = verify2FASetupSchema.safeParse({ code: "12ABC6" });
      expect(r.success).toBe(false);
    });

    it("refuse code manquant", () => {
      const r = verify2FASetupSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });

  describe("disable2FASchema", () => {
    it("accepte password + code TOTP", () => {
      const r = disable2FASchema.safeParse({
        password: "mypassword",
        code: "123456",
      });
      expect(r.success).toBe(true);
    });

    it("accepte password + backup code (10 chars hex)", () => {
      const r = disable2FASchema.safeParse({
        password: "mypassword",
        code: "ABCDEF1234",
      });
      expect(r.success).toBe(true);
    });

    it("refuse password vide", () => {
      const r = disable2FASchema.safeParse({ password: "", code: "123456" });
      expect(r.success).toBe(false);
    });

    it("refuse code trop court", () => {
      const r = disable2FASchema.safeParse({
        password: "pwd",
        code: "12345",
      });
      expect(r.success).toBe(false);
    });

    it("refuse code trop long (>20)", () => {
      const r = disable2FASchema.safeParse({
        password: "pwd",
        code: "x".repeat(21),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("validate2FALoginSchema", () => {
    it("accepte temp_token + code", () => {
      const r = validate2FALoginSchema.safeParse({
        temp_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        code: "123456",
      });
      expect(r.success).toBe(true);
    });

    it("refuse temp_token trop court", () => {
      const r = validate2FALoginSchema.safeParse({
        temp_token: "abc",
        code: "123456",
      });
      expect(r.success).toBe(false);
    });

    it("refuse code manquant", () => {
      const r = validate2FALoginSchema.safeParse({
        temp_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      });
      expect(r.success).toBe(false);
    });
  });
});
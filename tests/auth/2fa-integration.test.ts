import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser } from "../helpers/factories";
import { generateTOTP } from "../../src/core/api/auth/2fa/2fa.service";

describe("2FA integration", () => {
  // ============================================================
  // STATUS + SETUP
  // ============================================================

  describe("GET /auth/2fa/status", () => {
    it("retourne disabled par défaut", async () => {
      const user = await createUser({ email: "2fa1@test.com" });

      const res = await request(app)
        .get("/auth/2fa/status")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.setup_in_progress).toBe(false);
    });

    it("refuse si non authentifié (401)", async () => {
      const res = await request(app).get("/auth/2fa/status");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/2fa/setup", () => {
    it("génère un secret + QR code", async () => {
      const user = await createUser({ email: "2fa2@test.com" });

      const res = await request(app)
        .post("/auth/2fa/setup")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.secret).toBeTruthy();
      expect(res.body.qr_code).toMatch(/^data:image\/png;base64,/);
      expect(res.body.otpauth).toMatch(/^otpauth:\/\/totp\//);
      expect(res.body.otpauth).toContain("ANKUCAMP");
    });
  });

  // ============================================================
  // VERIFY SETUP
  // ============================================================

  describe("POST /auth/2fa/verify", () => {
    it("refuse un code invalide (400)", async () => {
      const user = await createUser({ email: "2fa3@test.com" });
      await request(app)
        .post("/auth/2fa/setup")
        .set("Authorization", user.authorization);

      const res = await request(app)
        .post("/auth/2fa/verify")
        .set("Authorization", user.authorization)
        .send({ code: "000000" });

      expect(res.status).toBe(400);
    });

    it("refuse un code mal formé (400)", async () => {
      const user = await createUser({ email: "2fa4@test.com" });
      await request(app)
        .post("/auth/2fa/setup")
        .set("Authorization", user.authorization);

      const res = await request(app)
        .post("/auth/2fa/verify")
        .set("Authorization", user.authorization)
        .send({ code: "abc" });

      expect(res.status).toBe(400);
    });

    it("active la 2FA + retourne 10 backup codes", async () => {
      const user = await createUser({ email: "2fa5@test.com" });
      const setupRes = await request(app)
        .post("/auth/2fa/setup")
        .set("Authorization", user.authorization);

      const code = generateTOTP(setupRes.body.secret);

      const res = await request(app)
        .post("/auth/2fa/verify")
        .set("Authorization", user.authorization)
        .send({ code });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.backup_codes).toHaveLength(10);

      // Vérifie que le status est maintenant enabled
      const statusRes = await request(app)
        .get("/auth/2fa/status")
        .set("Authorization", user.authorization);
      expect(statusRes.body.enabled).toBe(true);
    });
  });

  // ============================================================
  // LOGIN ÉTAPE 2
  // ============================================================

  describe("Login avec 2FA activée", () => {
    async function activate2FA(email: string, password: string) {
      const user = await createUser({ email, password });
      const setupRes = await request(app)
        .post("/auth/2fa/setup")
        .set("Authorization", user.authorization);
      const code = generateTOTP(setupRes.body.secret);
      const verifyRes = await request(app)
        .post("/auth/2fa/verify")
        .set("Authorization", user.authorization)
        .send({ code });
      return {
        user,
        secret: setupRes.body.secret,
        backupCodes: verifyRes.body.backup_codes,
      };
    }

    it("login renvoie requires_2fa + temp_token", async () => {
      await activate2FA("2fa-login1@test.com", "password123");

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "2fa-login1@test.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.requires_2fa).toBe(true);
      expect(res.body.temp_token).toBeTruthy();
      expect(res.body.token).toBeUndefined();
    });

    it("POST /auth/2fa/validate avec bon code → JWT", async () => {
      const { secret } = await activate2FA("2fa-login2@test.com", "password123");

      const loginRes = await request(app)
        .post("/auth/login")
        .send({ email: "2fa-login2@test.com", password: "password123" });

      const code = generateTOTP(secret);

      const res = await request(app)
        .post("/auth/2fa/validate")
        .send({ temp_token: loginRes.body.temp_token, code });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe("2fa-login2@test.com");
    });

    it("POST /auth/2fa/validate avec mauvais code → 401", async () => {
      await activate2FA("2fa-login3@test.com", "password123");

      const loginRes = await request(app)
        .post("/auth/login")
        .send({ email: "2fa-login3@test.com", password: "password123" });

      const res = await request(app)
        .post("/auth/2fa/validate")
        .send({ temp_token: loginRes.body.temp_token, code: "000000" });

      expect(res.status).toBe(401);
    });

    it("POST /auth/2fa/validate avec backup code → JWT", async () => {
      const { backupCodes } = await activate2FA("2fa-login4@test.com", "password123");

      const loginRes = await request(app)
        .post("/auth/login")
        .send({ email: "2fa-login4@test.com", password: "password123" });

      const res = await request(app)
        .post("/auth/2fa/validate")
        .send({
          temp_token: loginRes.body.temp_token,
          code: backupCodes[0],
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it("backup code consommé une seule fois", async () => {
      const { backupCodes } = await activate2FA("2fa-login5@test.com", "password123");

      // 1ère utilisation → OK
      const login1 = await request(app)
        .post("/auth/login")
        .send({ email: "2fa-login5@test.com", password: "password123" });
      await request(app)
        .post("/auth/2fa/validate")
        .send({ temp_token: login1.body.temp_token, code: backupCodes[0] });

      // 2ᵉ utilisation → refusé
      const login2 = await request(app)
        .post("/auth/login")
        .send({ email: "2fa-login5@test.com", password: "password123" });
      const res = await request(app)
        .post("/auth/2fa/validate")
        .send({ temp_token: login2.body.temp_token, code: backupCodes[0] });

      expect(res.status).toBe(401);
    });

    it("temp_token invalide → 401", async () => {
      const res = await request(app)
        .post("/auth/2fa/validate")
        .send({ temp_token: "invalid-token-1234567890", code: "123456" });

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // DISABLE
  // ============================================================

  describe("POST /auth/2fa/disable", () => {
    async function activate2FAForDisable(email: string, password: string) {
      const user = await createUser({ email, password });
      const setupRes = await request(app)
        .post("/auth/2fa/setup")
        .set("Authorization", user.authorization);
      const code = generateTOTP(setupRes.body.secret);
      await request(app)
        .post("/auth/2fa/verify")
        .set("Authorization", user.authorization)
        .send({ code });
      return { user, secret: setupRes.body.secret };
    }

    it("refuse mauvais mot de passe → 401", async () => {
      const { user, secret } = await activate2FAForDisable(
        "2fa-disable1@test.com",
        "password123"
      );

      const code = generateTOTP(secret);

      const res = await request(app)
        .post("/auth/2fa/disable")
        .set("Authorization", user.authorization)
        .send({ password: "WRONG", code });

      expect(res.status).toBe(401);
    });

    it("désactive avec password + code valide", async () => {
      const { user, secret } = await activate2FAForDisable(
        "2fa-disable2@test.com",
        "password123"
      );

      const code = generateTOTP(secret);

      const res = await request(app)
        .post("/auth/2fa/disable")
        .set("Authorization", user.authorization)
        .send({ password: "password123", code });

      expect(res.status).toBe(200);
      expect(res.body.disabled).toBe(true);

      // Vérifie que le status est disabled
      const statusRes = await request(app)
        .get("/auth/2fa/status")
        .set("Authorization", user.authorization);
      expect(statusRes.body.enabled).toBe(false);
    });
  });
});
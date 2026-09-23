import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import "./helpers/testSetup";

describe("Auth module", () => {
  const validUser = {
    full_name: "Alice Test",
    email: "alice@test.com",
    password: "motdepasse123",
    role: "particulier",
  };

  // ============================================
  // REGISTER
  // ============================================
  describe("POST /auth/register", () => {
    it("crée un nouvel utilisateur (201)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.role).toBe(validUser.role);
      // Le password_hash NE DOIT PAS être renvoyé
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it("refuse un email déjà utilisé (400)", async () => {
      // 1er register : OK
      await request(app).post("/auth/register").send(validUser);

      // 2e register avec le même email : erreur
      const res = await request(app).post("/auth/register").send(validUser);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Cet email est déjà utilisé");
    });

    it("refuse un email invalide (400)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validUser, email: "pas-un-email" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Données invalides");
    });

    it("refuse un mot de passe trop court (400)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validUser, password: "123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Données invalides");
    });
  });

  // ============================================
  // LOGIN
  // ============================================
  describe("POST /auth/login", () => {
    it("connecte un utilisateur existant (200 + token)", async () => {
      // Créer l'utilisateur
      await request(app).post("/auth/register").send(validUser);

      // Login
      const res = await request(app)
        .post("/auth/login")
        .send({ email: validUser.email, password: validUser.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe("string");
      expect(res.body.user.email).toBe(validUser.email);
    });

    it("refuse un mauvais mot de passe (401)", async () => {
      await request(app).post("/auth/register").send(validUser);

      const res = await request(app)
        .post("/auth/login")
        .send({ email: validUser.email, password: "faux" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Email ou mot de passe incorrect");
    });

    it("refuse un email inconnu (401)", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "inconnu@test.com", password: "motdepasse123" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
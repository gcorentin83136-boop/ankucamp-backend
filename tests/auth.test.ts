import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import "./helpers/testSetup";

describe("Auth module", () => {
  const validUser = {
    first_name: "Alice",
    last_name: "Dupont",
    email: "alice@test.com",
    birth_year: 1995,
    address: "1 rue de Paris",
    city: "Paris",
    postal_code: "75001",
    country: "France",
    password: "motdepasse123",
    role: "particulier",
  };

  describe("POST /auth/register", () => {
    it("crée un nouvel utilisateur (201)", async () => {
      const res = await request(app).post("/auth/register").send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(validUser.email);
      expect(res.body.user.first_name).toBe("Alice");
      expect(res.body.user.last_name).toBe("Dupont");
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it("refuse un email déjà utilisé (400)", async () => {
      await request(app).post("/auth/register").send(validUser);
      const res = await request(app).post("/auth/register").send(validUser);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cet email est déjà utilisé");
    });

    it("refuse un email invalide (400)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validUser, email: "pas-un-email" });

      expect(res.status).toBe(400);
    });

    it("refuse un mot de passe trop court (400)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validUser, password: "123" });

      expect(res.status).toBe(400);
    });

    it("refuse un âge < 13 ans (400)", async () => {
      const currentYear = new Date().getFullYear();
      const res = await request(app)
        .post("/auth/register")
        .send({ ...validUser, birth_year: currentYear - 5 });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("connecte un utilisateur existant (200 + token)", async () => {
      await request(app).post("/auth/register").send(validUser);

      const res = await request(app)
        .post("/auth/login")
        .send({ email: validUser.email, password: validUser.password });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.first_name).toBe("Alice");
    });

    it("refuse un mauvais mot de passe (401)", async () => {
      await request(app).post("/auth/register").send(validUser);

      const res = await request(app)
        .post("/auth/login")
        .send({ email: validUser.email, password: "faux" });

      expect(res.status).toBe(401);
    });
  });
});
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import "./helpers/testSetup";
import { createUser } from "./helpers/factories";

describe("Messages module", () => {
  // ============================================================
  // PUBLIC
  // ============================================================
  describe("GET /messages/public", () => {
    it("retourne une liste vide au départ", async () => {
      const res = await request(app).get("/messages/public");
      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });
  });

  describe("POST /messages/public", () => {
    it("refuse sans token (401)", async () => {
      const res = await request(app)
        .post("/messages/public")
        .send({ content: "Hello" });
      expect(res.status).toBe(401);
    });

    it("crée un message public (201)", async () => {
      const user = await createUser({ email: "user@test.com" });

      const res = await request(app)
        .post("/messages/public")
        .set("Authorization", user.authorization)
        .send({ content: "Bonjour tout le monde !" });

      expect(res.status).toBe(201);
      expect(res.body.message.content).toBe("Bonjour tout le monde !");
      expect(res.body.message.type).toBe("public");
    });

    it("refuse un contenu vide (400)", async () => {
      const user = await createUser({ email: "user@test.com" });

      const res = await request(app)
        .post("/messages/public")
        .set("Authorization", user.authorization)
        .send({ content: "" });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // GROUP
  // ============================================================
  describe("POST /messages/group", () => {
    it("crée un message de groupe (201)", async () => {
      const user = await createUser({ email: "user@test.com" });

      const res = await request(app)
        .post("/messages/group")
        .set("Authorization", user.authorization)
        .send({ group_id: 1, content: "Salut le groupe" });

      expect(res.status).toBe(201);
      expect(res.body.message.type).toBe("group");
      expect(res.body.message.group_id).toBe(1);
    });
  });

  describe("GET /messages/group/:groupId", () => {
    it("retourne les messages du groupe uniquement", async () => {
      const user = await createUser({ email: "user@test.com" });

      await request(app)
        .post("/messages/group")
        .set("Authorization", user.authorization)
        .send({ group_id: 1, content: "msg groupe 1" });

      await request(app)
        .post("/messages/group")
        .set("Authorization", user.authorization)
        .send({ group_id: 2, content: "msg groupe 2" });

      const res = await request(app)
        .get("/messages/group/1")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].content).toBe("msg groupe 1");
    });
  });

  // ============================================================
  // SUPPORT
  // ============================================================
  describe("POST /messages/support", () => {
    it("crée un message support (201)", async () => {
      const sender = await createUser({ email: "sender@test.com" });
      const receiver = await createUser({ email: "receiver@test.com" });

      const res = await request(app)
        .post("/messages/support")
        .set("Authorization", sender.authorization)
        .send({ receiver_id: receiver.id, content: "Question" });

      expect(res.status).toBe(201);
      expect(res.body.message.type).toBe("support");
      expect(res.body.message.receiver_id).toBe(receiver.id);
    });
  });

  describe("GET /messages/support/me", () => {
    it("retourne les messages support envoyés par l'utilisateur", async () => {
      const sender = await createUser({ email: "sender@test.com" });
      const receiver = await createUser({ email: "receiver@test.com" });

      await request(app)
        .post("/messages/support")
        .set("Authorization", sender.authorization)
        .send({ receiver_id: receiver.id, content: "Msg 1" });

      const res = await request(app)
        .get("/messages/support/me")
        .set("Authorization", sender.authorization);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
    });
  });

  // ============================================================
  // PAR ID
  // ============================================================
  describe("GET /messages/:id", () => {
    it("retourne un message par ID", async () => {
      const user = await createUser({ email: "user@test.com" });

      const created = await request(app)
        .post("/messages/public")
        .set("Authorization", user.authorization)
        .send({ content: "Hello" });

      const id = created.body.message.id;

      const res = await request(app)
        .get(`/messages/${id}`)
        .set("Authorization", user.authorization);

      expect(res.status).toBe(200);
      expect(res.body.message.id).toBe(id);
    });

    it("retourne 404 si le message n'existe pas", async () => {
      const user = await createUser({ email: "user@test.com" });

      const res = await request(app)
        .get("/messages/9999")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(404);
    });
  });
});
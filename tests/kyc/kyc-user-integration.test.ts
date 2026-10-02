import { describe, it, expect, vi } from "vitest";

// ⚠️ MOCK AVANT tout import du service KYC
// On mocke l'API gouvernementale pour éviter un appel réseau réel
vi.mock("../../src/core/api/kyc/siret.service", () => ({
  isValidSiretFormat: vi.fn().mockReturnValue(true),
  verifySiret: vi.fn().mockResolvedValue({
    valid: true,
    etablissement: {
      siret: "12345678900012",
      siren: "123456789",
      nom_complet: "Ferme de Test",
      nom_raison_sociale: "Ferme de Test SARL",
      sigle: null,
      activite_principale: "01.11Z",
      etat_administratif: "A",
      date_creation: "2010-01-01",
      date_fermeture: null,
      adresse: "1 rue des Champs",
      code_postal: "69001",
      ville: "Lyon",
      departement: "69",
      region: "Auvergne-Rhône-Alpes",
    },
  }),
}));

import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { testDb } from "../helpers/testSetup";
import { createUser } from "../helpers/factories";
import { kycRequests, users } from "../../src/core/db/schema";
import { eq } from "drizzle-orm";

describe("KYC user integration", () => {
  const VALID_SIRET = "12345678900012";
  const VALID_DOCUMENTS = ["https://res.cloudinary.com/demo/id-card.jpg"];

  // ============================================================
  // POST /kyc/request (pro only)
  // ============================================================

  describe("POST /kyc/request", () => {
    it("crée une demande KYC (201) + passe user en pending", async () => {
      const pro = await createUser({
        email: "kyc-pro-1@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .post("/kyc/request")
        .set("Authorization", pro.authorization)
        .send({
          type: "agriculteur",
          siret: VALID_SIRET,
          documents: VALID_DOCUMENTS,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.request.status).toBe("pending");
      expect(res.body.request.type).toBe("agriculteur");

      // Vérifie user.verification_status
      const [userAfter] = await testDb
        .select()
        .from(users)
        .where(eq(users.id, pro.id));
      expect(userAfter.verification_status).toBe("pending");
    });

    it("refuse si non pro (403)", async () => {
      const user = await createUser({ email: "kyc-part-1@test.com" });

      const res = await request(app)
        .post("/kyc/request")
        .set("Authorization", user.authorization)
        .send({
          type: "agriculteur",
          siret: VALID_SIRET,
          documents: VALID_DOCUMENTS,
        });

      expect(res.status).toBe(403);
    });

    it("refuse si non authentifié (401)", async () => {
      const res = await request(app)
        .post("/kyc/request")
        .send({
          type: "agriculteur",
          siret: VALID_SIRET,
          documents: VALID_DOCUMENTS,
        });

      expect(res.status).toBe(401);
    });

    it("refuse si SIRET invalide (400)", async () => {
      const pro = await createUser({
        email: "kyc-pro-2@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .post("/kyc/request")
        .set("Authorization", pro.authorization)
        .send({
          type: "agriculteur",
          siret: "123",
          documents: VALID_DOCUMENTS,
        });

      expect(res.status).toBe(400);
    });

    it("refuse si documents vide (400)", async () => {
      const pro = await createUser({
        email: "kyc-pro-3@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .post("/kyc/request")
        .set("Authorization", pro.authorization)
        .send({
          type: "agriculteur",
          siret: VALID_SIRET,
          documents: [],
        });

      expect(res.status).toBe(400);
    });

    it("refuse si une demande est déjà en cours (409)", async () => {
      const pro = await createUser({
        email: "kyc-pro-4@test.com",
        role: "professionnel",
      });

      await request(app)
        .post("/kyc/request")
        .set("Authorization", pro.authorization)
        .send({
          type: "agriculteur",
          siret: VALID_SIRET,
          documents: VALID_DOCUMENTS,
        });

      const res = await request(app)
        .post("/kyc/request")
        .set("Authorization", pro.authorization)
        .send({
          type: "artisan",
          siret: VALID_SIRET,
          documents: VALID_DOCUMENTS,
        });

      expect(res.status).toBe(409);
    });
  });

  // ============================================================
  // GET /kyc/me
  // ============================================================

  describe("GET /kyc/me", () => {
    it("retourne null si aucune demande", async () => {
      const pro = await createUser({
        email: "kyc-pro-5@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .get("/kyc/me")
        .set("Authorization", pro.authorization);

      expect(res.status).toBe(200);
      expect(res.body.request).toBeNull();
    });

    it("retourne la dernière demande", async () => {
      const pro = await createUser({
        email: "kyc-pro-6@test.com",
        role: "professionnel",
      });

      await request(app)
        .post("/kyc/request")
        .set("Authorization", pro.authorization)
        .send({
          type: "createur",
          siret: VALID_SIRET,
          documents: VALID_DOCUMENTS,
        });

      const res = await request(app)
        .get("/kyc/me")
        .set("Authorization", pro.authorization);

      expect(res.status).toBe(200);
      expect(res.body.request).not.toBeNull();
      expect(res.body.request.type).toBe("createur");
      expect(res.body.request.status).toBe("pending");
    });

    it("refuse si non pro (403)", async () => {
      const user = await createUser({ email: "kyc-part-2@test.com" });

      const res = await request(app)
        .get("/kyc/me")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // DELETE /kyc/me
  // ============================================================

  describe("DELETE /kyc/me", () => {
    it("annule la demande pending + reset user en none", async () => {
      const pro = await createUser({
        email: "kyc-pro-7@test.com",
        role: "professionnel",
      });

      await request(app)
        .post("/kyc/request")
        .set("Authorization", pro.authorization)
        .send({
          type: "agriculteur",
          siret: VALID_SIRET,
          documents: VALID_DOCUMENTS,
        });

      const res = await request(app)
        .delete("/kyc/me")
        .set("Authorization", pro.authorization);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Vérifie en DB
      const remaining = await testDb
        .select()
        .from(kycRequests)
        .where(eq(kycRequests.user_id, pro.id));
      expect(remaining).toHaveLength(0);

      const [userAfter] = await testDb
        .select()
        .from(users)
        .where(eq(users.id, pro.id));
      expect(userAfter.verification_status).toBe("none");
    });

    it("404 si aucune demande", async () => {
      const pro = await createUser({
        email: "kyc-pro-8@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .delete("/kyc/me")
        .set("Authorization", pro.authorization);

      expect(res.status).toBe(404);
    });

    it("refuse si non pro (403)", async () => {
      const user = await createUser({ email: "kyc-part-3@test.com" });

      const res = await request(app)
        .delete("/kyc/me")
        .set("Authorization", user.authorization);

      expect(res.status).toBe(403);
    });
  });
});
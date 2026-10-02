import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { testDb } from "../helpers/testSetup";
import "../helpers/testSetup";
import { createUser } from "../helpers/factories";
import { kycRequests, users, userBadges } from "../../src/core/db/schema";
import { eq, and, isNull } from "drizzle-orm";

describe("KYC admin integration", () => {
  async function setupPendingKyc(opts?: {
    type?: "agriculteur" | "artisan" | "createur" | "autre";
  }) {
    const admin = await createUser({
      email: `admin-kyc-${Date.now()}@test.com`,
      role: "admin",
    });
    const seller = await createUser({
      email: `seller-kyc-${Date.now()}@test.com`,
      role: "professionnel",
    });

    const [kyc] = await testDb
      .insert(kycRequests)
      .values({
        user_id: seller.id,
        status: "pending",
        type: opts?.type ?? "agriculteur",
        siret: "12345678900012",
        siret_verified: 1,
        siret_data: JSON.stringify({ nom_complet: "Ferme Test" }),
        documents: JSON.stringify(["https://example.com/doc.pdf"]),
      })
      .returning();

    await testDb
      .update(users)
      .set({ verification_status: "pending" })
      .where(eq(users.id, seller.id));

    return { admin, seller, kyc };
  }

  // ============================================================
  // LISTE + STATS
  // ============================================================

  describe("GET /admin/kyc/requests", () => {
    it("liste les demandes (admin)", async () => {
      const { admin } = await setupPendingKyc();

      const res = await request(app)
        .get("/admin/kyc/requests")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.requests.length).toBeGreaterThanOrEqual(1);
      expect(res.body.requests[0].status).toBe("pending");
      expect(res.body.requests[0].username).toBeTruthy();
    });

    it("filtre par status=approved (vide ici)", async () => {
      const { admin } = await setupPendingKyc();

      const res = await request(app)
        .get("/admin/kyc/requests?status=approved")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(0);
    });

    it("filtre par type=artisan", async () => {
      const { admin } = await setupPendingKyc({ type: "artisan" });

      const res = await request(app)
        .get("/admin/kyc/requests?type=artisan")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(1);
      expect(res.body.requests[0].type).toBe("artisan");
    });

    it("refuse si non-admin (403)", async () => {
      const seller = await createUser({
        email: "nonadmin-kyc@test.com",
        role: "professionnel",
      });

      const res = await request(app)
        .get("/admin/kyc/requests")
        .set("Authorization", seller.authorization);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /admin/kyc/requests/:id", () => {
    it("retourne le détail d'une demande", async () => {
      const { admin, kyc } = await setupPendingKyc();

      const res = await request(app)
        .get(`/admin/kyc/requests/${kyc.id}`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.request.id).toBe(kyc.id);
      expect(res.body.request.siret).toBe("12345678900012");
    });

    it("404 si ID inexistant", async () => {
      const { admin } = await setupPendingKyc();

      const res = await request(app)
        .get("/admin/kyc/requests/999999")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /admin/kyc/stats", () => {
    it("retourne les compteurs", async () => {
      const { admin } = await setupPendingKyc();

      const res = await request(app)
        .get("/admin/kyc/stats")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.stats.pending).toBe(1);
      expect(res.body.stats.total).toBe(1);
    });
  });

  // ============================================================
  // APPROVE
  // ============================================================

  describe("PUT /admin/kyc/requests/:id/approve", () => {
    it("approuve + badge 'verified' + badge spécifique", async () => {
      const { admin, seller, kyc } = await setupPendingKyc({
        type: "agriculteur",
      });

      const res = await request(app)
        .put(`/admin/kyc/requests/${kyc.id}/approve`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user_id).toBe(seller.id);

      // Vérifie verification_status
      const [sellerAfter] = await testDb
        .select()
        .from(users)
        .where(eq(users.id, seller.id));
      expect(sellerAfter.verification_status).toBe("verified");

      // Vérifie les badges
      const badges = await testDb
        .select()
        .from(userBadges)
        .where(
          and(
            eq(userBadges.user_id, seller.id),
            isNull(userBadges.revoked_at)
          )
        );
      const badgeNames = badges.map((b) => b.badge).sort();
      expect(badgeNames).toEqual(["agriculteur", "verified"]);
    });

    it("409 si déjà traité", async () => {
      const { admin, kyc } = await setupPendingKyc();

      // 1ère fois OK
      await request(app)
        .put(`/admin/kyc/requests/${kyc.id}/approve`)
        .set("Authorization", admin.authorization);

      // 2ᵉ fois → 409
      const res = await request(app)
        .put(`/admin/kyc/requests/${kyc.id}/approve`)
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(409);
    });

    it("404 si ID inexistant", async () => {
      const { admin } = await setupPendingKyc();

      const res = await request(app)
        .put("/admin/kyc/requests/999999/approve")
        .set("Authorization", admin.authorization);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // REJECT
  // ============================================================

  describe("PUT /admin/kyc/requests/:id/reject", () => {
    it("rejette avec un motif", async () => {
      const { admin, seller, kyc } = await setupPendingKyc();

      const res = await request(app)
        .put(`/admin/kyc/requests/${kyc.id}/reject`)
        .set("Authorization", admin.authorization)
        .send({ reason: "Documents illisibles, merci de refaire une photo." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Vérifie rejection_reason en DB
      const [kycAfter] = await testDb
        .select()
        .from(kycRequests)
        .where(eq(kycRequests.id, kyc.id));
      expect(kycAfter.status).toBe("rejected");
      expect(kycAfter.rejection_reason).toContain("illisibles");

      // Vérifie verification_status = rejected
      const [sellerAfter] = await testDb
        .select()
        .from(users)
        .where(eq(users.id, seller.id));
      expect(sellerAfter.verification_status).toBe("rejected");
    });

    it("400 si motif trop court (<10 car.)", async () => {
      const { admin, kyc } = await setupPendingKyc();

      const res = await request(app)
        .put(`/admin/kyc/requests/${kyc.id}/reject`)
        .set("Authorization", admin.authorization)
        .send({ reason: "Nope" });

      expect(res.status).toBe(400);
    });

    it("409 si déjà traité", async () => {
      const { admin, kyc } = await setupPendingKyc();

      await request(app)
        .put(`/admin/kyc/requests/${kyc.id}/approve`)
        .set("Authorization", admin.authorization);

      const res = await request(app)
        .put(`/admin/kyc/requests/${kyc.id}/reject`)
        .set("Authorization", admin.authorization)
        .send({ reason: "Trop tard, désolé." });

      expect(res.status).toBe(409);
    });
  });
});
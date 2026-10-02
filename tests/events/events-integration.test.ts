import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";
import "../helpers/testSetup";
import { createUser } from "../helpers/factories";
import { testDb } from "../helpers/testSetup";
import { events } from "../../src/core/db/schema";
import { eq } from "drizzle-orm";

describe("Events integration", () => {
  async function setupOrganizer() {
    const organizer = await createUser({
      email: `org-evt-${Date.now()}@test.com`,
      role: "professionnel",
    });
    const buyer = await createUser({
      email: `buyer-evt-${Date.now()}@test.com`,
    });
    return { organizer, buyer };
  }

  function futureDate(daysFromNow = 7) {
    return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
  }

  // ============================================================
  // CRÉATION (pro)
  // ============================================================

  describe("POST /events", () => {
    it("crée un événement (201)", async () => {
      const { organizer } = await setupOrganizer();

      const res = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché de Noël",
          type: "marche",
          start_at: futureDate(10),
          is_free: true,
          city: "Lyon",
        });

      expect(res.status).toBe(201);
      expect(res.body.event.title).toBe("Marché de Noël");
      expect(res.body.event.status).toBe("published");
    });

    it("refuse si non professionnel (403)", async () => {
      const { buyer } = await setupOrganizer();

      const res = await request(app)
        .post("/events")
        .set("Authorization", buyer.authorization)
        .send({
          title: "Hack",
          type: "marche",
          start_at: futureDate(),
          is_free: true,
        });

      expect(res.status).toBe(403);
    });

    it("refuse date de fin avant date de début (400)", async () => {
      const { organizer } = await setupOrganizer();

      const res = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Test",
          type: "marche",
          start_at: futureDate(10),
          end_at: futureDate(5),
          is_free: true,
        });

      expect(res.status).toBe(400);
    });

    it("refuse événement payant sans prix (400)", async () => {
      const { organizer } = await setupOrganizer();

      const res = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Test",
          type: "atelier",
          start_at: futureDate(5),
          is_free: false,
        });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // LECTURE
  // ============================================================

  describe("GET /events", () => {
    it("liste les événements à venir", async () => {
      const { organizer } = await setupOrganizer();

      await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Événement 1",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });
      await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Événement 2",
          type: "salon",
          start_at: futureDate(10),
          is_free: true,
        });

      const res = await request(app).get("/events");
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(2);
    });

    it("filtre par type", async () => {
      const { organizer } = await setupOrganizer();

      await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });
      await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Salon",
          type: "salon",
          start_at: futureDate(10),
          is_free: true,
        });

      const res = await request(app).get("/events?type=marche");
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].type).toBe("marche");
    });
  });

  describe("GET /events/:id", () => {
    it("retourne le détail avec is_registered_by_me", async () => {
      const { organizer, buyer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const res = await request(app)
        .get(`/events/${createRes.body.event.id}`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.event.is_registered_by_me).toBe(false);
      expect(res.body.event.registrations_count).toBe(0);
    });

    it("404 si inexistant", async () => {
      const res = await request(app).get("/events/999999");
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // INSCRIPTION
  // ============================================================

  describe("POST /events/:id/register", () => {
    it("inscrit un user (201)", async () => {
      const { organizer, buyer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const res = await request(app)
        .post(`/events/${createRes.body.event.id}/register`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("registered");
    });

    it("refuse si organisateur s'inscrit à son propre événement (400)", async () => {
      const { organizer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const res = await request(app)
        .post(`/events/${createRes.body.event.id}/register`)
        .set("Authorization", organizer.authorization);

      expect(res.status).toBe(400);
    });

    it("waitlist si capacité atteinte", async () => {
      const { organizer, buyer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Petit atelier",
          type: "atelier",
          start_at: futureDate(5),
          is_free: true,
          capacity: 1,
        });

      const eventId = createRes.body.event.id;

      // 1er inscrit → registered
      await request(app)
        .post(`/events/${eventId}/register`)
        .set("Authorization", buyer.authorization);

      // 2ème inscrit → waitlist
      const otherBuyer = await createUser({
        email: `other-evt-${Date.now()}@test.com`,
      });
      const res = await request(app)
        .post(`/events/${eventId}/register`)
        .set("Authorization", otherBuyer.authorization);

      expect(res.body.status).toBe("waitlist");
    });

    it("409 si déjà inscrit", async () => {
      const { organizer, buyer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const eventId = createRes.body.event.id;

      await request(app)
        .post(`/events/${eventId}/register`)
        .set("Authorization", buyer.authorization);

      const res = await request(app)
        .post(`/events/${eventId}/register`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /events/:id/register", () => {
    it("désinscrit un user (200)", async () => {
      const { organizer, buyer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const eventId = createRes.body.event.id;

      await request(app)
        .post(`/events/${eventId}/register`)
        .set("Authorization", buyer.authorization);

      const res = await request(app)
        .delete(`/events/${eventId}/register`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================
  // ANNULATION (organisateur)
  // ============================================================

  describe("PUT /events/:id/cancel", () => {
    it("annule l'événement (200)", async () => {
      const { organizer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const res = await request(app)
        .put(`/events/${createRes.body.event.id}/cancel`)
        .set("Authorization", organizer.authorization)
        .send({ reason: "Météo trop mauvaise ce jour-là." });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Vérifie en DB
      const [ev] = await testDb
        .select()
        .from(events)
        .where(eq(events.id, createRes.body.event.id));
      expect(ev.status).toBe("cancelled");
    });
  });

  // ============================================================
  // MES ÉVÉNEMENTS (organisateur)
  // ============================================================

  describe("GET /events/me", () => {
    it("liste mes événements", async () => {
      const { organizer } = await setupOrganizer();

      await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Mon événement",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const res = await request(app)
        .get("/events/me")
        .set("Authorization", organizer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(1);
    });
  });

  // ============================================================
  // INSCRIPTIONS (organisateur)
  // ============================================================

  describe("GET /events/:id/registrations", () => {
    it("retourne les inscrits (organisateur uniquement)", async () => {
      const { organizer, buyer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const eventId = createRes.body.event.id;

      await request(app)
        .post(`/events/${eventId}/register`)
        .set("Authorization", buyer.authorization);

      const res = await request(app)
        .get(`/events/${eventId}/registrations`)
        .set("Authorization", organizer.authorization);

      expect(res.status).toBe(200);
      expect(res.body.registrations).toHaveLength(1);
      expect(res.body.registrations[0].user_id).toBe(buyer.id);
    });

    it("refuse si pas l'organisateur (403)", async () => {
      const { organizer, buyer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
        });

      const res = await request(app)
        .get(`/events/${createRes.body.event.id}/registrations`)
        .set("Authorization", buyer.authorization);

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // NEARBY
  // ============================================================

  describe("GET /events/nearby", () => {
    it("filtre par distance (aucun résultat si trop loin)", async () => {
      const { organizer } = await setupOrganizer();

      const createRes = await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché Lyon",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
          latitude: 45.76,
          longitude: 4.83,
        });

      // Cherche à Paris (300+ km) avec rayon 10 km → pas de résultat
      const res = await request(app).get(
        "/events/nearby?lat=48.85&lng=2.35&radius=10"
      );

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(0);
    });

    it("trouve les événements proches", async () => {
      const { organizer } = await setupOrganizer();

      await request(app)
        .post("/events")
        .set("Authorization", organizer.authorization)
        .send({
          title: "Marché Lyon",
          type: "marche",
          start_at: futureDate(5),
          is_free: true,
          latitude: 45.76,
          longitude: 4.83,
        });

      // Cherche à Lyon avec rayon 10 km → trouve
      const res = await request(app).get(
        "/events/nearby?lat=45.76&lng=4.83&radius=10"
      );

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].distance_km).toBeLessThan(1);
    });
  });
});
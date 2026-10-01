import { describe, it, expect } from "vitest";
import {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  nearbyEventsQuerySchema,
  cancelEventSchema,
  EVENT_TYPES,
  EVENT_STATUSES,
  REGISTRATION_STATUSES,
} from "../../src/core/api/events/events.validation";

describe("events validation", () => {
  describe("createEventSchema", () => {
    const validInput = {
      title: "Marché de Noël",
      type: "marche" as const,
      start_at: new Date("2026-12-20T10:00:00Z"),
      is_free: true,
    };

    it("accepte un événement valide minimal", () => {
      const r = createEventSchema.safeParse(validInput);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.status).toBe("published");
        expect(r.data.is_free).toBe(true);
      }
    });

    it("accepte avec tous les champs", () => {
      const r = createEventSchema.safeParse({
        ...validInput,
        description: "Venez nombreux",
        cover_url: "https://example.com/cover.jpg",
        end_at: new Date("2026-12-20T18:00:00Z"),
        shop_id: 1,
        address: "Place de la Mairie",
        city: "Lyon",
        postal_code: "69001",
        latitude: 45.76,
        longitude: 4.83,
        capacity: 50,
        is_free: false,
        price: 5.5,
      });
      expect(r.success).toBe(true);
    });

    it("refuse un type inconnu", () => {
      const r = createEventSchema.safeParse({ ...validInput, type: "banana" });
      expect(r.success).toBe(false);
    });

    it("refuse un titre trop court", () => {
      const r = createEventSchema.safeParse({ ...validInput, title: "a" });
      expect(r.success).toBe(false);
    });

    it("refuse lat hors bornes", () => {
      const r = createEventSchema.safeParse({ ...validInput, latitude: 91 });
      expect(r.success).toBe(false);
    });

    it("coerce start_at en Date", () => {
      const r = createEventSchema.safeParse({
        ...validInput,
        start_at: "2026-12-20T10:00:00Z",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.start_at).toBeInstanceOf(Date);
    });
  });

  describe("updateEventSchema", () => {
    it("accepte objet vide (tout optionnel)", () => {
      const r = updateEventSchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepte juste un titre", () => {
      const r = updateEventSchema.safeParse({ title: "Nouveau titre" });
      expect(r.success).toBe(true);
    });
  });

  describe("listEventsQuerySchema", () => {
    it("applique les defaults", () => {
      const r = listEventsQuerySchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.type).toBe("all");
        expect(r.data.upcoming).toBe(true);
        expect(r.data.limit).toBe(20);
      }
    });

    it("accepte type=marche", () => {
      const r = listEventsQuerySchema.safeParse({ type: "marche" });
      expect(r.success).toBe(true);
    });

    it("accepte upcoming=false", () => {
      const r = listEventsQuerySchema.safeParse({ upcoming: "false" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.upcoming).toBe(false);
    });
  });

  describe("nearbyEventsQuerySchema", () => {
    it("accepte lat/lng avec defaults", () => {
      const r = nearbyEventsQuerySchema.safeParse({ lat: 48.85, lng: 2.35 });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.radius).toBe(25);
        expect(r.data.upcoming).toBe(true);
      }
    });

    it("refuse lat hors bornes", () => {
      const r = nearbyEventsQuerySchema.safeParse({ lat: 200, lng: 2.35 });
      expect(r.success).toBe(false);
    });
  });

  describe("cancelEventSchema", () => {
    it("accepte vide (reason optionnelle)", () => {
      const r = cancelEventSchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepte une raison", () => {
      const r = cancelEventSchema.safeParse({ reason: "Météo trop mauvaise" });
      expect(r.success).toBe(true);
    });

    it("refuse raison trop courte", () => {
      const r = cancelEventSchema.safeParse({ reason: "x" });
      expect(r.success).toBe(false);
    });
  });

  describe("constantes", () => {
    it("6 types d'événements", () => {
      expect(EVENT_TYPES.length).toBe(6);
    });
    it("4 statuts d'événements", () => {
      expect(EVENT_STATUSES.length).toBe(4);
    });
    it("4 statuts d'inscription", () => {
      expect(REGISTRATION_STATUSES.length).toBe(4);
    });
  });
});
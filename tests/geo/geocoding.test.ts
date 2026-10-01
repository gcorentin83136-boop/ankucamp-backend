import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAddress } from "../../src/core/api/geo/geocoding.service";
import {
  geocodeSchema,
  nearbyQuerySchema,
} from "../../src/core/api/geo/geo.validation";

describe("geo — geocodeSchema", () => {
  it("accepte une adresse valide", () => {
    const r = geocodeSchema.safeParse({ address: "10 rue de la Paix, Paris" });
    expect(r.success).toBe(true);
  });

  it("refuse une adresse trop courte", () => {
    const r = geocodeSchema.safeParse({ address: "ab" });
    expect(r.success).toBe(false);
  });

  it("refuse une adresse > 255 chars", () => {
    const r = geocodeSchema.safeParse({ address: "x".repeat(256) });
    expect(r.success).toBe(false);
  });
});

describe("geo — nearbyQuerySchema", () => {
  it("applique les defaults (radius 25, limit 20)", () => {
    const r = nearbyQuerySchema.safeParse({ lat: 48.85, lng: 2.35 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.radius).toBe(25);
      expect(r.data.limit).toBe(20);
      expect(r.data.offset).toBe(0);
    }
  });

  it("accepte radius personnalisé", () => {
    const r = nearbyQuerySchema.safeParse({ lat: 48.85, lng: 2.35, radius: 50 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.radius).toBe(50);
  });

  it("refuse lat hors bornes", () => {
    const r = nearbyQuerySchema.safeParse({ lat: 91, lng: 2.35 });
    expect(r.success).toBe(false);
  });

  it("refuse lng hors bornes", () => {
    const r = nearbyQuerySchema.safeParse({ lat: 48, lng: 200 });
    expect(r.success).toBe(false);
  });

  it("refuse radius > 500", () => {
    const r = nearbyQuerySchema.safeParse({ lat: 48, lng: 2, radius: 600 });
    expect(r.success).toBe(false);
  });
});

describe("geo — geocodeAddress (mock fetch)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne lat/lng sur adresse trouvée", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                label: "10 Rue de la Paix 75002 Paris",
                city: "Paris",
                postcode: "75002",
                score: 0.95,
              },
              geometry: { coordinates: [2.3314, 48.8686] },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await geocodeAddress("10 rue de la Paix Paris");
    expect(result.latitude).toBeCloseTo(48.8686, 3);
    expect(result.longitude).toBeCloseTo(2.3314, 3);
    expect(result.city).toBe("Paris");
    expect(result.postal_code).toBe("75002");
  });

  it("throw 404 si 0 résultat", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), { status: 200 })
    );

    await expect(geocodeAddress("adresse bidon xyz")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throw 502 si API 500", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("", { status: 500 })
    );

    await expect(geocodeAddress("10 rue de la Paix")).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("gère timeout", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("timeout"), { name: "TimeoutError" })
    );

    await expect(geocodeAddress("10 rue de la Paix")).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});
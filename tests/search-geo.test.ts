import { describe, it, expect } from "vitest";
import {
  searchShopsQuerySchema,
  searchProductsQuerySchema,
  searchUsersQuerySchema,
  searchAllQuerySchema,
} from "../src/core/api/search/search.validation";

describe("search geo — validation", () => {
  it("shops accepte lat/lng/radius optionnels", () => {
    const r = searchShopsQuerySchema.safeParse({
      lat: "48.85",
      lng: "2.35",
      radius: "50",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lat).toBe(48.85);
      expect(r.data.lng).toBe(2.35);
      expect(r.data.radius).toBe(50);
    }
  });

  it("shops applique radius=25 par défaut", () => {
    const r = searchShopsQuerySchema.safeParse({ lat: 48.85, lng: 2.35 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.radius).toBe(25);
  });

  it("shops refuse lat hors bornes", () => {
    const r = searchShopsQuerySchema.safeParse({ lat: 91, lng: 2.35 });
    expect(r.success).toBe(false);
  });

  it("shops refuse radius > 500", () => {
    const r = searchShopsQuerySchema.safeParse({
      lat: 48,
      lng: 2,
      radius: 600,
    });
    expect(r.success).toBe(false);
  });

  it("products accepte lat/lng/radius", () => {
    const r = searchProductsQuerySchema.safeParse({
      q: "fromage",
      lat: 48.85,
      lng: 2.35,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.q).toBe("fromage");
      expect(r.data.lat).toBe(48.85);
    }
  });

  it("users accepte lat/lng/radius", () => {
    const r = searchUsersQuerySchema.safeParse({
      lat: 48.85,
      lng: 2.35,
    });
    expect(r.success).toBe(true);
  });

  it("searchAll accepte lat/lng/radius", () => {
    const r = searchAllQuerySchema.safeParse({
      q: "bio",
      lat: 48.85,
      lng: 2.35,
      radius: 15,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.radius).toBe(15);
  });

  it("searchAll applique radius=25 par défaut", () => {
    const r = searchAllQuerySchema.safeParse({ q: "bio" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.radius).toBe(25);
  });

  it("lat sans lng reste valide (schema ne force pas l'un sans l'autre)", () => {
    const r = searchShopsQuerySchema.safeParse({ lat: 48.85 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lat).toBe(48.85);
      expect(r.data.lng).toBeUndefined();
    }
  });
});
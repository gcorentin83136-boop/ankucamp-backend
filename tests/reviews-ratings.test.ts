import { describe, it, expect } from "vitest";
import {
  getSellerGlobalRating,
  getBulkSellerRatings,
} from "../src/core/api/reviews/reviews.service";

describe("reviews.service - ratings helpers", () => {
  it("expose getSellerGlobalRating", () => {
    expect(typeof getSellerGlobalRating).toBe("function");
  });

  it("expose getBulkSellerRatings", () => {
    expect(typeof getBulkSellerRatings).toBe("function");
  });

  it("getBulkSellerRatings retourne une Map vide si liste vide", async () => {
    const map = await getBulkSellerRatings([]);
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });

  it("getBulkSellerRatings retourne une Map (test forme)", async () => {
    // Sur un ID inexistant : doit renvoyer { average: 0, count: 0 }
    const map = await getBulkSellerRatings([999999]);
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(1);
    const entry = map.get(999999);
    expect(entry).toEqual({ average: 0, count: 0 });
  });

  it("getSellerGlobalRating retourne { average, count } sur ID inexistant", async () => {
    const r = await getSellerGlobalRating(999999);
    expect(r).toHaveProperty("average");
    expect(r).toHaveProperty("count");
    expect(r.average).toBe(0);
    expect(r.count).toBe(0);
  });
});
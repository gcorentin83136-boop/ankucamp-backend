import { describe, it, expect } from "vitest";
import { BADGES, grantBadgeSchema } from "../../src/core/api/kyc/kyc.validation";

describe("badges validation", () => {
  it("contient 6 badges", () => {
    expect(BADGES.length).toBe(6);
    expect(BADGES).toContain("verified");
    expect(BADGES).toContain("agriculteur");
    expect(BADGES).toContain("bio");
  });

  it("accepte un badge valide", () => {
    const parsed = grantBadgeSchema.safeParse({ badge: "verified" });
    expect(parsed.success).toBe(true);
  });

  it("refuse un badge inconnu", () => {
    const parsed = grantBadgeSchema.safeParse({ badge: "hacker" });
    expect(parsed.success).toBe(false);
  });
});
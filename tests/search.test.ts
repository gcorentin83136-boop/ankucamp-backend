// ============================================================
// ANKUCAMP — Tests d'intégration du module Search
// ============================================================

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

// ============================================================
// 1. GET /search/all
// ============================================================

describe("Search — GET /search/all", () => {
  it("retourne 200 avec q=a", async () => {
    const res = await request(app).get("/search/all?q=a");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.query).toBe("a");
    expect(res.body.counts).toHaveProperty("users");
    expect(res.body.counts).toHaveProperty("shops");
    expect(res.body.counts).toHaveProperty("products");
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(Array.isArray(res.body.shops)).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it("rejette q manquant (400)", async () => {
    const res = await request(app).get("/search/all");
    expect(res.status).toBe(400);
  });

  it("rejette q vide (400)", async () => {
    const res = await request(app).get("/search/all?q=");
    expect(res.status).toBe(400);
  });

  it("respecte limit_per_type", async () => {
    const res = await request(app).get("/search/all?q=a&limit_per_type=2");

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(2);
    expect(res.body.shops.length).toBeLessThanOrEqual(2);
    expect(res.body.products.length).toBeLessThanOrEqual(2);
  });

  it("rejette limit_per_type > 10 (400)", async () => {
    const res = await request(app).get("/search/all?q=a&limit_per_type=20");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 2. GET /search/users
// ============================================================

describe("Search — GET /search/users", () => {
  it("retourne 200 sans filtre", async () => {
    const res = await request(app).get("/search/users");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it("accepte q", async () => {
    const res = await request(app).get("/search/users?q=a");
    expect(res.status).toBe(200);
  });

  it("accepte role=particulier", async () => {
    const res = await request(app).get("/search/users?role=particulier");
    expect(res.status).toBe(200);
  });

  it("accepte role=professionnel", async () => {
    const res = await request(app).get("/search/users?role=professionnel");
    expect(res.status).toBe(200);
  });

  it("accepte city", async () => {
    const res = await request(app).get("/search/users?city=Paris");
    expect(res.status).toBe(200);
  });

  it("accepte sort=alphabetical", async () => {
    const res = await request(app).get("/search/users?sort=alphabetical");
    expect(res.status).toBe(200);
  });

  it("accepte sort=recent", async () => {
    const res = await request(app).get("/search/users?sort=recent");
    expect(res.status).toBe(200);
  });

  it("accepte pagination limit=2 offset=0", async () => {
    const res = await request(app).get("/search/users?limit=2&offset=0");
    expect(res.status).toBe(200);
  });

  it("accepte pagination limit=2 offset=2", async () => {
    const res = await request(app).get("/search/users?limit=2&offset=2");
    expect(res.status).toBe(200);
  });

  it("accepte unaccent (q=cafe)", async () => {
    const res = await request(app).get("/search/users?q=cafe");
    expect(res.status).toBe(200);
  });

  it("rejette limit > 50 (400)", async () => {
    const res = await request(app).get("/search/users?limit=100");
    expect(res.status).toBe(400);
  });

  it("rejette offset négatif (400)", async () => {
    const res = await request(app).get("/search/users?offset=-1");
    expect(res.status).toBe(400);
  });

  it("rejette role invalide (400)", async () => {
    const res = await request(app).get("/search/users?role=admin");
    expect(res.status).toBe(400);
  });

  it("rejette sort invalide (400)", async () => {
    const res = await request(app).get("/search/users?sort=random");
    expect(res.status).toBe(400);
  });

  it("retourne les champs attendus", async () => {
    const res = await request(app).get("/search/users?limit=1");

    if (res.body.results.length > 0) {
      const user = res.body.results[0];
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("first_name");
      expect(user).toHaveProperty("last_name");
      expect(user).toHaveProperty("username");
      expect(user).toHaveProperty("role");
    }
  });
});

// ============================================================
// 3. GET /search/shops
// ============================================================

describe("Search — GET /search/shops", () => {
  it("retourne 200 sans filtre", async () => {
    const res = await request(app).get("/search/shops");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it("accepte q", async () => {
    const res = await request(app).get("/search/shops?q=a");
    expect(res.status).toBe(200);
  });

  it("accepte sort=rating", async () => {
    const res = await request(app).get("/search/shops?sort=rating");
    expect(res.status).toBe(200);
  });

  it("accepte sort=products_count", async () => {
    const res = await request(app).get("/search/shops?sort=products_count");
    expect(res.status).toBe(200);
  });

  it("accepte city", async () => {
    const res = await request(app).get("/search/shops?city=Paris");
    expect(res.status).toBe(200);
  });

  it("accepte category_id", async () => {
    const res = await request(app).get("/search/shops?category_id=1");
    expect(res.status).toBe(200);
  });

  it("rejette sort invalide (400)", async () => {
    const res = await request(app).get("/search/shops?sort=unknown");
    expect(res.status).toBe(400);
  });

  it("retourne products_count et average_rating", async () => {
    const res = await request(app).get("/search/shops?limit=1");

    if (res.body.results.length > 0) {
      const shop = res.body.results[0];
      expect(shop).toHaveProperty("products_count");
      expect(shop).toHaveProperty("average_rating");
    }
  });
});

// ============================================================
// 4. GET /search/products
// ============================================================

describe("Search — GET /search/products", () => {
  it("retourne 200 sans filtre", async () => {
    const res = await request(app).get("/search/products");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it("accepte q", async () => {
    const res = await request(app).get("/search/products?q=a");
    expect(res.status).toBe(200);
  });

  it("accepte min_price", async () => {
    const res = await request(app).get("/search/products?min_price=10");
    expect(res.status).toBe(200);
  });

  it("accepte max_price", async () => {
    const res = await request(app).get("/search/products?max_price=100");
    expect(res.status).toBe(200);
  });

  it("accepte min_price + max_price", async () => {
    const res = await request(app).get(
      "/search/products?min_price=10&max_price=100"
    );
    expect(res.status).toBe(200);
  });

  it("accepte in_stock=true", async () => {
    const res = await request(app).get("/search/products?in_stock=true");
    expect(res.status).toBe(200);
  });

  it("accepte sort=price_asc", async () => {
    const res = await request(app).get("/search/products?sort=price_asc");
    expect(res.status).toBe(200);
  });

  it("accepte sort=price_desc", async () => {
    const res = await request(app).get("/search/products?sort=price_desc");
    expect(res.status).toBe(200);
  });

  it("accepte sort=rating", async () => {
    const res = await request(app).get("/search/products?sort=rating");
    expect(res.status).toBe(200);
  });

  it("accepte shop_id", async () => {
    const res = await request(app).get("/search/products?shop_id=1");
    expect(res.status).toBe(200);
  });

  it("accepte min_rating", async () => {
    const res = await request(app).get("/search/products?min_rating=4");
    expect(res.status).toBe(200);
  });

  it("rejette min_price non numérique (400)", async () => {
    const res = await request(app).get("/search/products?min_price=abc");
    expect(res.status).toBe(400);
  });

  it("rejette sort invalide (400)", async () => {
    const res = await request(app).get("/search/products?sort=unknown");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 5. GET /search/suggest
// ============================================================

describe("Search — GET /search/suggest", () => {
  it("retourne 200 avec q=te", async () => {
    const res = await request(app).get("/search/suggest?q=te");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(Array.isArray(res.body.shops)).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it("accepte limit", async () => {
    const res = await request(app).get("/search/suggest?q=test&limit=3");
    expect(res.status).toBe(200);
  });

  it("respecte limit", async () => {
    const res = await request(app).get("/search/suggest?q=te&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(2);
    expect(res.body.shops.length).toBeLessThanOrEqual(2);
    expect(res.body.products.length).toBeLessThanOrEqual(2);
  });

  it("rejette q < 2 caractères (400)", async () => {
    const res = await request(app).get("/search/suggest?q=a");
    expect(res.status).toBe(400);
  });

  it("rejette q manquant (400)", async () => {
    const res = await request(app).get("/search/suggest");
    expect(res.status).toBe(400);
  });

  it("rejette limit > 10 (400)", async () => {
    const res = await request(app).get("/search/suggest?q=test&limit=20");
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 6. SÉCURITÉ — routes publiques
// ============================================================

describe("Search — Sécurité", () => {
  it("toutes les routes search sont publiques (pas de 401/403)", async () => {
    const routes = [
      "/search/users",
      "/search/shops",
      "/search/products",
      "/search/all?q=a",
      "/search/suggest?q=te",
    ];

    for (const route of routes) {
      const res = await request(app).get(route);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    }
  });

  it("retourne 404 sur route inexistante", async () => {
    const res = await request(app).get("/search/unknown");
    expect(res.status).toBe(404);
  });
});
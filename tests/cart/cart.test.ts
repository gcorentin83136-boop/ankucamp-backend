import { describe, it, expect } from "vitest";
import {
  addToCartSchema,
  updateCartItemSchema,
  cartCheckoutSchema,
} from "../../src/core/api/cart/cart.validation";

describe("cart validation", () => {
  describe("addToCartSchema", () => {
    it("accepte un ajout valide", () => {
      const r = addToCartSchema.safeParse({ product_id: 5, quantity: 2 });
      expect(r.success).toBe(true);
    });

    it("applique quantity=1 par défaut", () => {
      const r = addToCartSchema.safeParse({ product_id: 5 });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.quantity).toBe(1);
    });

    it("refuse product_id négatif", () => {
      const r = addToCartSchema.safeParse({ product_id: -1 });
      expect(r.success).toBe(false);
    });

    it("refuse quantity > 99", () => {
      const r = addToCartSchema.safeParse({ product_id: 5, quantity: 100 });
      expect(r.success).toBe(false);
    });

    it("refuse quantity = 0", () => {
      const r = addToCartSchema.safeParse({ product_id: 5, quantity: 0 });
      expect(r.success).toBe(false);
    });
  });

  describe("updateCartItemSchema", () => {
    it("accepte une quantité valide", () => {
      const r = updateCartItemSchema.safeParse({ quantity: 3 });
      expect(r.success).toBe(true);
    });

    it("refuse quantité manquante", () => {
      const r = updateCartItemSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });

  describe("cartCheckoutSchema", () => {
    it("accepte pickup", () => {
      const r = cartCheckoutSchema.safeParse({ delivery_method: "pickup" });
      expect(r.success).toBe(true);
    });

    it("accepte avec promo", () => {
      const r = cartCheckoutSchema.safeParse({
        delivery_method: "shipping",
        promo_code: "WELCOME10",
        delivery_address: "10 rue de la Paix, Paris",
      });
      expect(r.success).toBe(true);
    });

    it("refuse delivery_method inconnu", () => {
      const r = cartCheckoutSchema.safeParse({ delivery_method: "banana" });
      expect(r.success).toBe(false);
    });
  });
});
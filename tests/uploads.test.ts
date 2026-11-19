// ============================================================
// ANKUCAMP — Tests unitaires Uploads
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { uploadAvatar, uploadShopLogo } from "../src/core/api/uploads/uploads.controller";
import { AppError } from "../src/core/errors/AppError";

// Mock de la réponse Express
function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("Uploads — Contrôleur", () => {
  it("uploadAvatar rejette sans fichier (400)", async () => {
    const req: any = { user: { id: 1 }, file: undefined };
    const res = mockRes();

    // On vérifie que l'appel lève bien une AppError
    await expect(uploadAvatar(req, res)).rejects.toThrowError(
      new AppError("Aucun fichier fourni", 400)
    );
  });

  it("uploadShopLogo rejette si shop_id manquant (400)", async () => {
    const req: any = { user: { id: 1 }, file: { buffer: Buffer.from("fake") }, body: {} };
    const res = mockRes();

    await expect(uploadShopLogo(req, res)).rejects.toThrowError(
      new AppError("shop_id requis dans le body", 400)
    );
  });
});
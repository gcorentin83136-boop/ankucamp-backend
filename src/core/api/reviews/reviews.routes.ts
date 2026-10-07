import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  create,
  listByProduct,
  productStats,
  listSellerReviews,
  listMyReviews,
  remove,
  report,
  reply,
  update,
} from "./reviews.controller";

const router = Router();

// ============================================================
// ROUTES PUBLIQUES (pas d'auth)
// ============================================================

// Stats d'un produit (moyenne + distribution)
router.get("/product/:id/stats", asyncHandler(productStats));

// Liste des avis d'un produit
router.get("/product/:id", asyncHandler(listByProduct));

// ============================================================
// ROUTES PROTÉGÉES (auth obligatoire)
// ============================================================

// Créer un avis
router.post("/", authMiddleware, asyncHandler(create));

// Mes avis (en tant qu'auteur)
router.get("/me", authMiddleware, asyncHandler(listMyReviews));

// Avis reçus (en tant que vendeur)
router.get("/seller/me", authMiddleware, asyncHandler(listSellerReviews));

// Signaler un avis (en tant que vendeur)
router.post("/:id/reply", authMiddleware, asyncHandler(reply));

router.put("/:id", authMiddleware, asyncHandler(update));

router.post("/:id/report", authMiddleware, asyncHandler(report));

// Supprimer son avis (en tant qu'auteur)
router.delete("/:id", authMiddleware, asyncHandler(remove));

export default router;
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  request,
  listMine,
  listAll,
  getOne,
  approve,
  reject,
} from "./refunds.controller";

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ============================================================
// BUYER
// ============================================================

// Demander un remboursement
router.post("/request", asyncHandler(request));

// Mes demandes de remboursement
router.get("/me", asyncHandler(listMine));

// ============================================================
// ADMIN
// ============================================================

// Liste toutes les demandes (avec filtres)
router.get("/", requireRole("admin"), asyncHandler(listAll));

// Approuver un remboursement
router.put("/:id/approve", requireRole("admin"), asyncHandler(approve));

// Rejeter un remboursement
router.put("/:id/reject", requireRole("admin"), asyncHandler(reject));

// ============================================================
// BUYER OU ADMIN
// ============================================================

// Détail d'une demande
router.get("/:id", asyncHandler(getOne));

export default router;
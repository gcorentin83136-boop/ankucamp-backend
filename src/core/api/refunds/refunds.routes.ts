import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { refundsLimiter } from "../../../config/security";
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
// RATE LIMITING : 5 demandes/heure par user
// ============================================================

router.use(refundsLimiter);

// ============================================================
// BUYER
// ============================================================

router.post("/request", asyncHandler(request));
router.get("/me", asyncHandler(listMine));

// ============================================================
// ADMIN
// ============================================================

router.get("/", requireRole("admin"), asyncHandler(listAll));
router.put("/:id/approve", requireRole("admin"), asyncHandler(approve));
router.put("/:id/reject", requireRole("admin"), asyncHandler(reject));

// ============================================================
// BUYER OU ADMIN
// ============================================================

router.get("/:id", asyncHandler(getOne));

export default router;
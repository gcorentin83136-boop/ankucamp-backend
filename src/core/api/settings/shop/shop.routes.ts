import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import {
  get,
  updateAll,
  putVacation,
  putHidden,
  putReturns,
  putContact,
} from "./shop.controller";

const router = Router();

router.use(authMiddleware);

// ============================================================
// LECTURE
// ============================================================

router.get("/:shopId", asyncHandler(get));

// ============================================================
// MISE À JOUR
// ============================================================

router.put("/:shopId", asyncHandler(updateAll));
router.put("/:shopId/vacation", asyncHandler(putVacation));
router.put("/:shopId/hidden", asyncHandler(putHidden));
router.put("/:shopId/returns", asyncHandler(putReturns));
router.put("/:shopId/contact", asyncHandler(putContact));

export default router;
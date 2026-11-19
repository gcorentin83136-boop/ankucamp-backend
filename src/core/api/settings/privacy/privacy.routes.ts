import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import {
  get,
  updateAll,
  updateVisibility,
  updateMessages,
} from "./privacy.controller";

const router = Router();

router.use(authMiddleware);

// ============================================================
// LECTURE
// ============================================================

router.get("/", asyncHandler(get));

// ============================================================
// MISE À JOUR
// ============================================================

router.put("/", asyncHandler(updateAll));
router.put("/visibility", asyncHandler(updateVisibility));
router.put("/messages", asyncHandler(updateMessages));

export default router;
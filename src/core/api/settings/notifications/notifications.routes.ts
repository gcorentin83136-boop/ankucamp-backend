import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import {
  get,
  updateAll,
  updateEmail,
  updatePush,
} from "./notifications.controller";

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
router.put("/email", asyncHandler(updateEmail));
router.put("/push", asyncHandler(updatePush));

export default router;
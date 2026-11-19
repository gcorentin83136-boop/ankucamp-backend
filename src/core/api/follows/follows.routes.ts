import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  toggle,
  mine,
  count,
  shopFollowers,
  shopFollowersCount,
  status,
} from "./follows.controller";

const router = Router();

router.use(authMiddleware);

// ============================================================
// MES FOLLOWS
// ============================================================

router.get("/me", asyncHandler(mine));
router.get("/me/count", asyncHandler(count));

// ============================================================
// FOLLOWERS D'UNE BOUTIQUE
// ============================================================

router.get("/shop/:shopId/followers", asyncHandler(shopFollowers));
router.get("/shop/:shopId/count", asyncHandler(shopFollowersCount));
router.get("/shop/:shopId/status", asyncHandler(status));

// ============================================================
// TOGGLE FOLLOW
// ============================================================

router.post("/shop/:shopId", asyncHandler(toggle));

export default router;
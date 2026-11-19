import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  getBadges,
  adminGrantBadge,
  adminRevokeBadge,
} from "./badges.controller";

const router = Router();

router.get("/:id/badges", asyncHandler(getBadges));

router.post(
  "/:id/badges",
  authMiddleware,
  requireRole("admin"),
  asyncHandler(adminGrantBadge)
);

router.delete(
  "/:id/badges/:badge",
  authMiddleware,
  requireRole("admin"),
  asyncHandler(adminRevokeBadge)
);

export default router;
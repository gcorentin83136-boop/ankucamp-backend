import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  postKycRequest,
  getMyKyc,
  deleteMyKyc,
} from "./kyc.controller";

const router = Router();

router.post(
  "/request",
  authMiddleware,
  requireRole("professionnel"),
  asyncHandler(postKycRequest)
);

router.get(
  "/me",
  authMiddleware,
  requireRole("professionnel"),
  asyncHandler(getMyKyc)
);

router.delete(
  "/me",
  authMiddleware,
  requireRole("professionnel"),
  asyncHandler(deleteMyKyc)
);

export default router;
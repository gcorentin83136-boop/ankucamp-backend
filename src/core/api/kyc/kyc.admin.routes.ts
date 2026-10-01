import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  adminListKyc,
  adminGetKyc,
  adminApproveKyc,
  adminRejectKyc,
  adminKycStats,
} from "./kyc.admin.controller";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/requests", asyncHandler(adminListKyc));
router.get("/stats", asyncHandler(adminKycStats));
router.get("/requests/:id", asyncHandler(adminGetKyc));
router.put("/requests/:id/approve", asyncHandler(adminApproveKyc));
router.put("/requests/:id/reject", asyncHandler(adminRejectKyc));

export default router;
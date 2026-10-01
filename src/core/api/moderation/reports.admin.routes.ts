import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  adminListReports,
  adminGetReport,
  adminResolveReport,
  adminDismissReport,
  adminReportsStats,
} from "./reports.admin.controller";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/reports", asyncHandler(adminListReports));
router.get("/reports/stats", asyncHandler(adminReportsStats));
router.get("/reports/:id", asyncHandler(adminGetReport));
router.put("/reports/:id/resolve", asyncHandler(adminResolveReport));
router.put("/reports/:id/dismiss", asyncHandler(adminDismissReport));

export default router;
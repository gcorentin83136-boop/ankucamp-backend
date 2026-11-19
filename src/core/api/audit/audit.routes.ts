import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { list, stats } from "./audit.controller";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/logs", asyncHandler(list));
router.get("/stats", asyncHandler(stats));

export default router;
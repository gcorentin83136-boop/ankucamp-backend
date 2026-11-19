import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { run, list, stats } from "./backup.controller";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.post("/run", asyncHandler(run));
router.get("/list", asyncHandler(list));
router.get("/stats", asyncHandler(stats));

export default router;
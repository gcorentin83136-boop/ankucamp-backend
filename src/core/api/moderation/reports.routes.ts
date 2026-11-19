import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { postReport } from "./reports.controller";

const router = Router();

router.post("/", authMiddleware, asyncHandler(postReport));

export default router;
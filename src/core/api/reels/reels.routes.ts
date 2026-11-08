import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import * as reelsController from "./reels.controller";

const router = Router();
router.use(authMiddleware);

router.get("/", asyncHandler(reelsController.getFeed));
router.post("/", asyncHandler(reelsController.create));
router.post("/:id/like", asyncHandler(reelsController.like));

export default router;
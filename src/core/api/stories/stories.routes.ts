import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { create, feed, updateStoryVisibility, remove } from "./stories.controller";

const router = Router();

router.use(authMiddleware);

router.post("/", asyncHandler(create));
router.get("/", asyncHandler(feed));
router.patch("/:id/visibility", asyncHandler(updateStoryVisibility));
router.delete("/:id", asyncHandler(remove));

export default router;
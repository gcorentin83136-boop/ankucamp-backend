import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import * as storiesController from "./stories.controller";

const router = Router();
router.use(authMiddleware);

router.get("/", asyncHandler(storiesController.getFeed));
router.post("/", asyncHandler(storiesController.create));
router.patch("/:id/visibility", asyncHandler(storiesController.updateVisibilityCtrl)); // 🆕
router.delete("/:id", asyncHandler(storiesController.remove));

export default router;
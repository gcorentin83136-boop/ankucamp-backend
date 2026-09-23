import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { getMe, updateMe, getOne, getAll } from "./users.controller";

const router = Router();

router.get("/me", authMiddleware, asyncHandler(getMe));
router.put("/me", authMiddleware, asyncHandler(updateMe));

router.get("/", asyncHandler(getAll));
router.get("/:id", asyncHandler(getOne));

export default router;
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { list, create, update, remove } from "./promo.admin.controller";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.put("/:id", asyncHandler(update));
router.delete("/:id", asyncHandler(remove));

export default router;
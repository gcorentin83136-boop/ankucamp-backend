import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { listMine, create, update, remove } from "./promo.seller.controller";

const router = Router();

router.use(authMiddleware, requireRole("professionnel"));

router.get("/", asyncHandler(listMine));
router.post("/", asyncHandler(create));
router.put("/:id", asyncHandler(update));
router.delete("/:id", asyncHandler(remove));

export default router;
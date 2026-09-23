import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  listPublic,
  createPublic,
  listGroup,
  createGroup,
  listSupportMine,
  listSupportByShop,
  createSupport,
  getOne,
} from "./messages.controller";

const router = Router();

router.get("/public", asyncHandler(listPublic));
router.post("/public", authMiddleware, asyncHandler(createPublic));

router.get("/group/:groupId", authMiddleware, asyncHandler(listGroup));
router.post("/group", authMiddleware, asyncHandler(createGroup));

router.get("/support/me", authMiddleware, asyncHandler(listSupportMine));
router.get("/support/shop/:shopId", authMiddleware, asyncHandler(listSupportByShop));
router.post("/support", authMiddleware, asyncHandler(createSupport));

router.get("/:id", authMiddleware, asyncHandler(getOne));

export default router;
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  listShops,
  getOneShop,
  listMyShops,
  createOneShop,
  updateOneShop,
  deleteOneShop,
} from "./shops.controller";

const router = Router();

router.get("/", asyncHandler(listShops));

router.get("/owner/me", authMiddleware, asyncHandler(listMyShops));

router.post(
  "/",
  authMiddleware,
  requireRole("professionnel"),
  asyncHandler(createOneShop)
);

router.get("/:id", asyncHandler(getOneShop));
router.put("/:id", authMiddleware, asyncHandler(updateOneShop));
router.delete("/:id", authMiddleware, asyncHandler(deleteOneShop));

export default router;
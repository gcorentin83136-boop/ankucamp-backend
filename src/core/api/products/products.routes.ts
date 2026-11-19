import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  listProducts,
  listByShop,
  getOne,
  createOne,
  updateOne,
  deleteOne,
} from "./products.controller";

const router = Router();

router.get("/", asyncHandler(listProducts));
router.get("/shop/:shopId", asyncHandler(listByShop));

router.post(
  "/",
  authMiddleware,
  requireRole("professionnel"),
  asyncHandler(createOne)
);

router.get("/:id", asyncHandler(getOne));
router.put("/:id", authMiddleware, asyncHandler(updateOne));
router.delete("/:id", authMiddleware, asyncHandler(deleteOne));

export default router;
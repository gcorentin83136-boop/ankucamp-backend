import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  listMyOrders,
  listSellerOrders,
  getOne,
  createOne,
  updateStatus,
  deleteOne,
} from "./orders.controller";

const router = Router();

router.use(authMiddleware);

router.get("/me", asyncHandler(listMyOrders));
router.get("/seller/me", asyncHandler(listSellerOrders));
router.post("/", asyncHandler(createOne));

router.get("/:id", asyncHandler(getOne));
router.put("/:id/status", asyncHandler(updateStatus));
router.delete("/:id", asyncHandler(deleteOne));

export default router;
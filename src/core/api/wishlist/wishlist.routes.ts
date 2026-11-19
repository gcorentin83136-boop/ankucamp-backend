import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  toggle,
  mine,
  count,
  check,
  productIds,
} from "./wishlist.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(mine));
router.get("/count", asyncHandler(count));
router.get("/product-ids", asyncHandler(productIds));
router.get("/check/:productId", asyncHandler(check));
router.post("/:productId", asyncHandler(toggle));

export default router;
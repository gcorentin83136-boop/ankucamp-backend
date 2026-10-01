import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  getCart,
  add,
  update,
  remove,
  clear,
  checkout,
} from "./cart.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", asyncHandler(getCart));
router.post("/items", asyncHandler(add));
router.put("/items/:productId", asyncHandler(update));
router.delete("/items/:productId", asyncHandler(remove));
router.delete("/", asyncHandler(clear));

router.post("/checkout", asyncHandler(checkout));

export default router;
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { upload } from "../../middlewares/upload.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  uploadAvatar,
  uploadShopLogo,
  uploadProductImage,
} from "./uploads.controller";

const router = Router();

router.post(
  "/avatar",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadAvatar)
);

router.post(
  "/shop-logo",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadShopLogo)
);

router.post(
  "/product",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadProductImage)
);

export default router;
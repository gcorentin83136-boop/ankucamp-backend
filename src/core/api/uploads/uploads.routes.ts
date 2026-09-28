import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { upload } from "../../middlewares/upload.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  uploadAvatar,
  uploadCover,
  uploadShopLogo,
  uploadProductImage,
  uploadPostMedia,
} from "./uploads.controller";

const router = Router();

// ============================================================
// AVATAR
// ============================================================

router.post(
  "/avatar",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadAvatar)
);

// ============================================================
// COVER
// ============================================================

router.post(
  "/cover",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadCover)
);

// ============================================================
// SHOP LOGO
// ============================================================

router.post(
  "/shop-logo",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadShopLogo)
);

// ============================================================
// PRODUCT IMAGE
// ============================================================

router.post(
  "/product",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadProductImage)
);

// ============================================================
// POST MEDIA (retourne juste l'URL)
// ============================================================

router.post(
  "/post-media",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadPostMedia)
);

export default router;
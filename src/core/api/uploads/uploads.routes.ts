import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { upload, uploadDocument } from "../../middlewares/upload.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { uploadsLimiter } from "../../../config/security";
import {
  uploadAvatar,
  uploadCover,
  uploadShopLogo,
  uploadProductImage,
  uploadPostMedia,
  uploadKycDocument,
} from "./uploads.controller";

const router = Router();

// Rate limiting : 10 uploads/min par user
router.use(uploadsLimiter);

// ============================================================
// IMAGES
// ============================================================

router.post("/avatar", authMiddleware, upload.single("file"), asyncHandler(uploadAvatar));
router.post("/cover", authMiddleware, upload.single("file"), asyncHandler(uploadCover));
router.post("/shop-logo", authMiddleware, upload.single("file"), asyncHandler(uploadShopLogo));
router.post("/product", authMiddleware, upload.single("file"), asyncHandler(uploadProductImage));
router.post("/post-media", authMiddleware, upload.single("file"), asyncHandler(uploadPostMedia));

// ============================================================
// DOCUMENTS KYC (PDF + images) ⭐ NOUVEAU
// ============================================================

router.post(
  "/kyc-document",
  authMiddleware,
  uploadDocument.single("file"),
  asyncHandler(uploadKycDocument)
);

export default router;

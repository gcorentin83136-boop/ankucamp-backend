import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  upload,
  uploadDocument,
  uploadVideo,
} from "../../middlewares/upload.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { uploadsLimiter } from "../../../config/security";
import {
  uploadAvatar,
  uploadCover,
  uploadShopLogo,
  uploadProductImage,
  uploadProductImageDraft,
  uploadProductVideo,
  uploadEventCover,
  uploadCommentMedia,
  uploadProductVideoDraft,
  deleteProductVideo,
  uploadPostMedia,
  uploadKycDocument,
} from "./uploads.controller";

const router = Router();

// ============================================================
// ROUTES D'UPLOAD
// ============================================================

router.post(
  "/event-cover",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadEventCover)
);

router.post(
  "/comment-media",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadCommentMedia)
);

// Rate limiting : 10 uploads/min par user
router.use(uploadsLimiter);

// ============================================================
// IMAGES
// ============================================================

router.post(
  "/avatar",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadAvatar)
);

router.post(
  "/cover",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadCover)
);

router.post(
  "/shop-logo",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadShopLogo)
);

// Image liee a un produit existant (update)
router.post(
  "/product",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadProductImage)
);

// Image DRAFT (avant creation produit) - retourne juste l'URL
router.post(
  "/product-image-draft",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadProductImageDraft)
);

// Media de post
router.post(
  "/post-media",
  authMiddleware,
  upload.single("file"),
  asyncHandler(uploadPostMedia)
);

// ============================================================
// VIDEOS PRODUIT
// ============================================================

router.post(
  "/product-video-draft",
  authMiddleware,
  uploadVideo.single("file"),
  asyncHandler(uploadProductVideoDraft)
);

router.post(
  "/product-video",
  authMiddleware,
  uploadVideo.single("file"),
  asyncHandler(uploadProductVideo)
);

router.delete(
  "/product-video",
  authMiddleware,
  asyncHandler(deleteProductVideo)
);

// ============================================================
// DOCUMENTS KYC (PDF + images)
// ============================================================

router.post(
  "/kyc-document",
  authMiddleware,
  uploadDocument.single("file"),
  asyncHandler(uploadKycDocument)
);

export default router;

import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  uploadAvatar, uploadCover, uploadShopLogo, uploadProductImage,
  uploadPostMedia, uploadPostVideo, uploadKycDocument, uploadProductImageDraft,
  uploadProductVideo, deleteProductVideo, uploadProductVideoDraft,
  uploadEventCover, uploadChatMedia, uploadCommentMedia
} from "./uploads.controller";

const router = Router();

// 🆕 Configuration Multer (mémoire + limite 250Mo + formats acceptés)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250 Mo
  fileFilter: (req, file, cb) => {
    // On accepte les images et les vidéos (mp4, webm, mov, etc.)
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Format non supporté. Seuls les images et vidéos sont acceptés."));
    }
  }
});

router.use(authMiddleware);

router.post("/avatar", upload.single("file"), uploadAvatar);
router.post("/cover", upload.single("file"), uploadCover);
router.post("/shop-logo", upload.single("file"), uploadShopLogo);
router.post("/product", upload.single("file"), uploadProductImage);
router.post("/post-media", upload.single("file"), uploadPostMedia);
router.post("/post-video", upload.single("file"), uploadPostVideo); // 👈 C'est cette route qui plantait
router.post("/kyc-document", upload.single("file"), uploadKycDocument);
router.post("/product-image-draft", upload.single("file"), uploadProductImageDraft);
router.post("/product-video", upload.single("file"), uploadProductVideo);
router.delete("/product-video", deleteProductVideo);
router.post("/product-video-draft", upload.single("file"), uploadProductVideoDraft);
router.post("/event-cover", upload.single("file"), uploadEventCover);
router.post("/chat-media", upload.single("file"), uploadChatMedia);
router.post("/comment-media", upload.single("file"), uploadCommentMedia);

export default router;
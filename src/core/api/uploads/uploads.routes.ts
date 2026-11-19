import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { uploadsLimiter } from "../../../config/security";
import {
  uploadAvatar, uploadCover, uploadShopLogo, uploadProductImage,
  uploadPostMedia, uploadKycDocument, uploadProductImageDraft,
  uploadProductVideo, deleteProductVideo, uploadProductVideoDraft,
  uploadEventCover, uploadChatMedia, uploadCommentMedia
} from "./uploads.controller";

const router = Router();

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "public", "uploads", "videos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `video-${Date.now()}${ext}`);
  }
});

const uploadLocal = multer({ storage: localStorage, limits: { fileSize: 250 * 1024 * 1024 } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 250 * 1024 * 1024 } });

router.use(authMiddleware);

router.post("/post-video", uploadsLimiter, uploadLocal.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucun fichier fourni" });
  const url = `${req.protocol}://${req.get("host")}/uploads/videos/${req.file.filename}`;
  return res.status(200).json({ success: true, message: "Vidéo sauvegardée en local", url });
});

router.post("/avatar", uploadsLimiter, upload.single("file"), uploadAvatar);
router.post("/cover", uploadsLimiter, upload.single("file"), uploadCover);
router.post("/shop-logo", uploadsLimiter, upload.single("file"), uploadShopLogo);
router.post("/product", uploadsLimiter, upload.single("file"), uploadProductImage);
router.post("/post-media", uploadsLimiter, upload.single("file"), uploadPostMedia);
router.post("/kyc-document", uploadsLimiter, upload.single("file"), uploadKycDocument);
router.post("/product-image-draft", uploadsLimiter, upload.single("file"), uploadProductImageDraft);
router.post("/product-video", uploadsLimiter, upload.single("file"), uploadProductVideo);
router.delete("/product-video", deleteProductVideo);
router.post("/product-video-draft", uploadsLimiter, upload.single("file"), uploadProductVideoDraft);
router.post("/event-cover", uploadsLimiter, upload.single("file"), uploadEventCover);
router.post("/chat-media", uploadsLimiter, upload.single("file"), uploadChatMedia);
router.post("/comment-media", uploadsLimiter, upload.single("file"), uploadCommentMedia);

export default router;
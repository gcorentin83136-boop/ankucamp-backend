import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  uploadAvatar, uploadCover, uploadShopLogo, uploadProductImage,
  uploadPostMedia, uploadKycDocument, uploadProductImageDraft,
  uploadProductVideo, deleteProductVideo, uploadProductVideoDraft,
  uploadEventCover, uploadChatMedia, uploadCommentMedia
} from "./uploads.controller";

const router = Router();

// 🆕 Configuration Multer locale SANS fileFilter
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "public", "uploads", "videos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `video-${Date.now()}${path.extname(file.originalname) || '.mp4'}`);
  }
});

const uploadLocal = multer({
  storage: localStorage,
  limits: { fileSize: 250 * 1024 * 1024 },
  // 🆕 Pas de fileFilter = on accepte tout
});

// Configuration Multer classique (Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 },
});

router.use(authMiddleware);

// 🆕 Route locale pour la vidéo (sans Cloudinary, sans filtre)
router.post("/post-video", uploadLocal.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucun fichier fourni" });
  const url = `${req.protocol}://${req.get("host")}/uploads/videos/${req.file.filename}`;
  return res.status(200).json({ success: true, message: "Vidéo sauvegardée en local", url });
});

// Routes Cloudinary
router.post("/avatar", upload.single("file"), uploadAvatar);
router.post("/cover", upload.single("file"), uploadCover);
router.post("/shop-logo", upload.single("file"), uploadShopLogo);
router.post("/product", upload.single("file"), uploadProductImage);
router.post("/post-media", upload.single("file"), uploadPostMedia);
router.post("/kyc-document", upload.single("file"), uploadKycDocument);
router.post("/product-image-draft", upload.single("file"), uploadProductImageDraft);
router.post("/product-video", upload.single("file"), uploadProductVideo);
router.delete("/product-video", deleteProductVideo);
router.post("/product-video-draft", upload.single("file"), uploadProductVideoDraft);
router.post("/event-cover", upload.single("file"), uploadEventCover);
router.post("/chat-media", upload.single("file"), uploadChatMedia);
router.post("/comment-media", upload.single("file"), uploadCommentMedia);

export default router;
import multer from "multer";
import { AppError } from "../errors/AppError";

// ------------------------------------------------------------
// Upload IMAGES (avatars, covers, products...)
// ------------------------------------------------------------
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError(
          "Format d'image non supporté (jpeg, png, webp, gif uniquement)",
          400
        )
      );
    }
    cb(null, true);
  },
});

// ------------------------------------------------------------
// Upload DOCUMENTS (KYC : PDF + images, 10 MB max)
// ------------------------------------------------------------
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError(
          "Format de document non supporté (PDF, jpeg, png, webp uniquement)",
          400
        )
      );
    }
    cb(null, true);
  },
});

// ------------------------------------------------------------
// Upload VIDÉOS (produits : mp4, webm, mov, 50 MB max)
// ------------------------------------------------------------
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
];

export const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError(
          "Format vidéo non supporté (mp4, webm, mov uniquement)",
          400
        )
      );
    }
    cb(null, true);
  },
});

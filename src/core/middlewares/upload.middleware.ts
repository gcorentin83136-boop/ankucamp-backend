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

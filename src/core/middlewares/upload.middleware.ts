import multer from "multer";
import { AppError } from "../errors/AppError";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Multer configuré pour stocker en mémoire (buffer).
 * Le buffer est ensuite envoyé à Cloudinary, pas sauvegardé sur disque.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
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
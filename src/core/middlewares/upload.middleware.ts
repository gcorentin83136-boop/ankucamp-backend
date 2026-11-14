import multer from "multer";
import { AppError } from "../errors/AppError";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 250 * 1024 * 1024, // 250 Mo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new AppError("Format de fichier non supporté. Image ou vidéo requis.", 400));
    }
  },
});
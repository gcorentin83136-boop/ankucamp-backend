import multer from "multer";
import { AppError } from "../errors/AppError";

// 🆕 Configuration de Multer
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 250 * 1024 * 1024, // 🆕 250 Mo (pour les vidéos de story)
  },
  fileFilter: (req, file, cb) => {
    // 🆕 On accepte explicitement les images et les vidéos (dont le WebM de la caméra)
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new AppError("Format de fichier non supporté. Image ou vidéo requis.", 400));
    }
  },
});
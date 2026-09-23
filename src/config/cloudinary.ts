import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

// Vérifier que les 3 variables sont bien définies
if (
  !env.CLOUDINARY_CLOUD_NAME ||
  !env.CLOUDINARY_API_KEY ||
  !env.CLOUDINARY_API_SECRET
) {
  throw new Error(
    "Cloudinary : CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET sont requis dans .env"
  );
}

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true, // HTTPS
});

export { cloudinary };
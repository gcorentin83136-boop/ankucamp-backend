import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../errors/asyncHandler";
import { postContact } from "./contact.controller";

const router = Router();

// Rate limit : 5 messages / 10 min par IP
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Trop de messages. Réessaie plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/", contactLimiter, asyncHandler(postContact));

export default router;

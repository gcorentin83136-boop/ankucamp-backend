import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import {
  status,
  setup,
  verify,
  disable,
  validateLogin,
} from "./2fa.controller";

const router = Router();

// Pas d'auth : étape 2 du login (utilise le temp_token)
router.post("/validate", asyncHandler(validateLogin));

// Auth requise : gestion de la 2FA
router.get("/status", authMiddleware, asyncHandler(status));
router.post("/setup", authMiddleware, asyncHandler(setup));
router.post("/verify", authMiddleware, asyncHandler(verify));
router.post("/disable", authMiddleware, asyncHandler(disable));

export default router;
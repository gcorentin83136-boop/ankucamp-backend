import { Router } from "express";
import {
  register,
  login,
  logout,
  activate,
  forgot,
  reset,
} from "./auth.controller";
import { asyncHandler } from "../../errors/asyncHandler";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { authLimiter } from "../../../config/security";
import oauthRoutes from "./auth.oauth";

const router = Router();

// Routes classiques (email / password)
router.post("/register", authLimiter, asyncHandler(register));
router.post("/login", authLimiter, asyncHandler(login));
router.post("/logout", authMiddleware, asyncHandler(logout));

// Activation de compte
router.post("/activate", asyncHandler(activate));

// Mot de passe oublié
router.post("/forgot-password", authLimiter, asyncHandler(forgot));
router.post("/reset-password", asyncHandler(reset));

// Routes OAuth (Google, etc.)
router.use("/", oauthRoutes);

export default router;
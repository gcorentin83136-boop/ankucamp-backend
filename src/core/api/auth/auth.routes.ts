import { Router } from "express";
import { register, login } from "./auth.controller";
import { asyncHandler } from "../../errors/asyncHandler";
import { authLimiter } from "../../../config/security";
import oauthRoutes from "./auth.oauth";

const router = Router();

// Routes classiques (email / password)
router.post("/register", authLimiter, asyncHandler(register));
router.post("/login", authLimiter, asyncHandler(login));

// Routes OAuth (Google, etc.)
router.use("/", oauthRoutes);

export default router;
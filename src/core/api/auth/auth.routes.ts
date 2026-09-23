import { Router } from "express";
import { register, login } from "./auth.controller";
import { asyncHandler } from "../../errors/asyncHandler";
import { authLimiter } from "../../../config/security";

const router = Router();

router.post("/register", authLimiter, asyncHandler(register));
router.post("/login", authLimiter, asyncHandler(login));

export default router;
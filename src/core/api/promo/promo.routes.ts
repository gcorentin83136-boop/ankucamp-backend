import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { validate } from "./promo.controller";

const router = Router();

router.use(authMiddleware);

router.post("/validate", asyncHandler(validate));

export default router;
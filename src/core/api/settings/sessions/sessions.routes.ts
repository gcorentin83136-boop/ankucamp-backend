import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import { list, revoke, revokeAll } from "./sessions.controller";

const router = Router();

router.use(authMiddleware);

// ============================================================
// LECTURE
// ============================================================

router.get("/", asyncHandler(list));

// ============================================================
// RÉVOCATION
// ============================================================

// ⚠️ Route spécifique AVANT /:id
router.delete("/all", asyncHandler(revokeAll));

router.delete("/:id", asyncHandler(revoke));

export default router;
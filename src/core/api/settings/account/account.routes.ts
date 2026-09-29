import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import {
  me,
  putEmail,
  putPassword,
  putUsername,
  putInfo,
  deactivate,
} from "./account.controller";

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ============================================================
// LECTURE
// ============================================================

router.get("/", asyncHandler(me));

// ============================================================
// MODIFICATIONS
// ============================================================

router.put("/email", asyncHandler(putEmail));
router.put("/password", asyncHandler(putPassword));
router.put("/username", asyncHandler(putUsername));
router.put("/info", asyncHandler(putInfo));

// ============================================================
// DÉSACTIVATION
// ============================================================

router.delete("/deactivate", asyncHandler(deactivate));

export default router;
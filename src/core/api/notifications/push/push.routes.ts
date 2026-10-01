import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import {
  subscribe,
  unsubscribe,
  listMine,
} from "./push.controller";

const router = Router();

// Toutes les routes nécessitent un auth
router.use(authMiddleware);

// ============================================================
// SUBSCRIBE / UNSUBSCRIBE
// ============================================================

router.post("/subscribe", asyncHandler(subscribe));
router.delete("/unsubscribe", asyncHandler(unsubscribe));

// ============================================================
// MES APPAREILS
// ============================================================

router.get("/subscriptions", asyncHandler(listMine));

export default router;
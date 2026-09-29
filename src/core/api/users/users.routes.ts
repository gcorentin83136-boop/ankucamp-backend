import { Router } from "express";
import {
  authMiddleware,
  authOptionalMiddleware,
} from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  getMe,
  updateMe,
  putPrivacy,
  getAll,
  getOne,
  getByUsername,
  getStats,
  getFriends,
} from "./users.controller";

const router = Router();

// ============================================================
// MES INFOS (auth obligatoire)
// ============================================================

router.get("/me", authMiddleware, asyncHandler(getMe));
router.put("/me", authMiddleware, asyncHandler(updateMe));
router.put("/me/privacy", authMiddleware, asyncHandler(putPrivacy));

// ============================================================
// LECTURE PUBLIQUE
// ============================================================

router.get("/", asyncHandler(getAll));

// ⚠️ Route spécifique AVANT /:id
router.get("/u/:username", asyncHandler(getByUsername));

// Stats + amis d'un user
router.get("/:id/stats", asyncHandler(getStats));

// Amis : auth optionnelle (profil privé → seul le propriétaire voit)
router.get("/:id/friends", authOptionalMiddleware, asyncHandler(getFriends));

// Route dynamique générique EN DERNIER
router.get("/:id", asyncHandler(getOne));

export default router;
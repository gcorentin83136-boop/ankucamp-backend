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
  becomePro,
} from "./users.controller";

const router = Router();

// ============================================================
// MES INFOS (auth obligatoire)
// ============================================================

router.get("/me", authMiddleware, asyncHandler(getMe));
router.put("/me", authMiddleware, asyncHandler(updateMe));
router.put("/me/privacy", authMiddleware, asyncHandler(putPrivacy));
router.post("/me/become-pro", authMiddleware, asyncHandler(becomePro));

// ============================================================
// LECTURE PUBLIQUE
// ============================================================

router.get("/", asyncHandler(getAll));

// âš ï¸ Route spÃ©cifique AVANT /:id
router.get("/u/:username", asyncHandler(getByUsername));

// Stats + amis d'un user
router.get("/:id/stats", asyncHandler(getStats));

// Amis : auth optionnelle (profil privÃ© â†’ seul le propriÃ©taire voit)
router.get("/:id/friends", authOptionalMiddleware, asyncHandler(getFriends));

// Route dynamique gÃ©nÃ©rique EN DERNIER
router.get("/:id", asyncHandler(getOne));

export default router;

import { Router } from "express";
import {
  authMiddleware,
  authOptionalMiddleware,
} from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
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
  adminSuspend,
  adminUnsuspend,
  adminDeleteUser,
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
// ADMIN — SUSPENSION / SUPPRESSION
// (places avant /:id pour eviter les collisions)
// ============================================================

router.post(
  "/:id/suspend",
  authMiddleware,
  requireRole("admin"),
  asyncHandler(adminSuspend)
);

router.post(
  "/:id/unsuspend",
  authMiddleware,
  requireRole("admin"),
  asyncHandler(adminUnsuspend)
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  asyncHandler(adminDeleteUser)
);

// ============================================================
// LECTURE PUBLIQUE
// ============================================================

router.get("/", asyncHandler(getAll));

// Route specifique AVANT /:id
router.get("/u/:username", asyncHandler(getByUsername));

// Stats + amis d'un user
router.get("/:id/stats", asyncHandler(getStats));

// Amis : auth optionnelle (profil prive -> seul le proprietaire voit)
router.get("/:id/friends", authOptionalMiddleware, asyncHandler(getFriends));

// Route dynamique generique EN DERNIER
router.get("/:id", asyncHandler(getOne));

export default router;

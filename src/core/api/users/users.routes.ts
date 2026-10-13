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
  skipProfileOnboarding,
} from "./users.controller";
import {
  postBlock,
  deleteBlock,
  postRestrict,
  deleteRestrict,
  getMyBlocked,
  getMyRestricted,
  getBlockStatus,
} from "./blocks.controller";

const router = Router();

// ============================================================
// MES INFOS (auth obligatoire)
// ============================================================

router.get("/me", authMiddleware, asyncHandler(getMe));
router.put("/me", authMiddleware, asyncHandler(updateMe));
router.put("/me/privacy", authMiddleware, asyncHandler(putPrivacy));
router.post("/me/become-pro", authMiddleware, asyncHandler(becomePro));
router.post("/me/profile/skip", authMiddleware, asyncHandler(skipProfileOnboarding));

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

// ============================================================
// BLOCAGE / RESTRICTION
// (avant /:id pour eviter les collisions)
// ============================================================

router.get("/me/blocked", authMiddleware, asyncHandler(getMyBlocked));
router.get("/me/restricted", authMiddleware, asyncHandler(getMyRestricted));

router.post("/:id/block", authMiddleware, asyncHandler(postBlock));
router.delete("/:id/block", authMiddleware, asyncHandler(deleteBlock));
router.post("/:id/restrict", authMiddleware, asyncHandler(postRestrict));
router.delete("/:id/restrict", authMiddleware, asyncHandler(deleteRestrict));
router.get("/:id/block-status", authMiddleware, asyncHandler(getBlockStatus));

// ============================================================
// LECTURE PUBLIQUE
// ============================================================

router.get("/", asyncHandler(getAll));

// Route specifique AVANT /:id
router.get("/u/:username", authOptionalMiddleware, asyncHandler(getByUsername));

// Stats + amis d'un user
router.get("/:id/stats", asyncHandler(getStats));

// Amis : auth optionnelle (profil prive -> seul le proprietaire voit)
router.get("/:id/friends", authOptionalMiddleware, asyncHandler(getFriends));

// Route dynamique generique EN DERNIER
router.get("/:id", authOptionalMiddleware, asyncHandler(getOne));

export default router;

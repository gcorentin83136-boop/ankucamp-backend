import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  listMine,
  unreadCount,
  markRead,
  markAllRead,
  deleteOne,
} from "./notifications.controller";

const router = Router();

// Toutes les routes nécessitent une auth
router.use(authMiddleware);

// ============================================================
// LECTURE
// ============================================================

// Liste mes notifications
router.get("/me", asyncHandler(listMine));

// Compteur de notifications non lues (badge)
// ⚠️ Doit être déclaré AVANT /:id pour ne pas être capturé
router.get("/me/unread-count", asyncHandler(unreadCount));

// ============================================================
// MISE À JOUR
// ============================================================

// Marquer TOUTES mes notifications comme lues
router.put("/read-all", asyncHandler(markAllRead));

// Marquer UNE notification comme lue
router.put("/:id/read", asyncHandler(markRead));

// ============================================================
// SUPPRESSION
// ============================================================

router.delete("/:id", asyncHandler(deleteOne));

export default router;
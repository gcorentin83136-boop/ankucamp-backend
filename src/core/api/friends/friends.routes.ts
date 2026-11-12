import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  sendRequest,
  accept,
  decline,
  cancel,
  remove,
  list,
  receivedRequests,
  sentRequests,
  status,
  stats,
} from "./friends.controller";

const router = Router();

router.use(authMiddleware);

// ============================================================
// STATS & STATUT (Routes spécifiques EN PREMIER)
// ============================================================

router.get("/stats", asyncHandler(stats));
router.get("/status/:userId", asyncHandler(status)); // 🆕 Déplacé ici !

// ============================================================
// LISTES
// ============================================================

router.get("/me", asyncHandler(list));
router.get("/requests/received", asyncHandler(receivedRequests));
router.get("/requests/sent", asyncHandler(sentRequests));

// ============================================================
// ACTIONS SUR LES DEMANDES
// ============================================================

router.post("/request/:userId", asyncHandler(sendRequest));

router.put("/:id/accept", asyncHandler(accept));
router.put("/:id/decline", asyncHandler(decline));
router.delete("/:id/cancel", asyncHandler(cancel));

// ============================================================
// SUPPRESSION D'UN AMI (Route dynamique EN DERNIER)
// ============================================================

router.delete("/:userId", asyncHandler(remove));

export default router;
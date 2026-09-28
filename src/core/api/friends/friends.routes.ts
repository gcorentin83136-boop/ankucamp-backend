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
// STATS & STATUT
// ============================================================

router.get("/stats", asyncHandler(stats));

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
// SUPPRESSION D'UN AMI
// ============================================================

router.delete("/:userId", asyncHandler(remove));

// ============================================================
// STATUT RELATION
// ============================================================

router.get("/status/:userId", asyncHandler(status));

export default router;
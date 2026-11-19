import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../errors/asyncHandler";
import {
  exportData,
  exportStatus,
  requestDeletion,
  cancelDeletion,
  deletionStatus,
  acceptances,
  acceptDoc,
} from "./gdpr.controller";

const router = Router();

router.use(authMiddleware);

// ============================================================
// EXPORT DES DONNÉES
// ============================================================

router.post("/export", asyncHandler(exportData));
router.get("/export/status", asyncHandler(exportStatus));

// ============================================================
// SUPPRESSION DE COMPTE
// ============================================================

router.post("/delete", asyncHandler(requestDeletion));
router.delete("/delete", asyncHandler(cancelDeletion));
router.get("/deletion/status", asyncHandler(deletionStatus));

// ============================================================
// ACCEPTATIONS LÉGALES
// ============================================================

router.get("/acceptances", asyncHandler(acceptances));
router.post("/acceptance", asyncHandler(acceptDoc));

export default router;
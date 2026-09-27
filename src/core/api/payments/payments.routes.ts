import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  checkout,
  webhook,
  listMine,
  getOneByOrder,
  onboardConnect,
  connectStatus,
} from "./payments.controller";

const router = Router();

// ⚠️ Webhook : le raw() est monté dans app.ts AVANT express.json()
router.post("/webhook", asyncHandler(webhook));

// Routes protégées (paiement)
router.post("/checkout", authMiddleware, asyncHandler(checkout));
router.get("/me", authMiddleware, asyncHandler(listMine));
router.get("/order/:orderId", authMiddleware, asyncHandler(getOneByOrder));

// Stripe Connect (onboarding pro)
router.post("/connect/onboard", authMiddleware, asyncHandler(onboardConnect));
router.get("/connect/status", authMiddleware, asyncHandler(connectStatus));

export default router;
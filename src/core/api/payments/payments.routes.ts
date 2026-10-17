import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import { checkoutLimiter } from "../../../config/security";
import {
  checkout,
  webhook,
  listMine,
  listSellerMine,
  exportSellerInvoicesPdf,
  getOneByOrder,
  onboardConnect,
  connectStatus,
  disconnectConnect,
  setupIntent,
  myPaymentMethods,
  deletePaymentMethod,
  setRedisplay,
  updatePaymentMethodHandler,
} from "./payments.controller";

const router = Router();

// ⚠️ Webhook : le raw() est monté dans app.ts AVANT express.json()
router.post("/webhook", asyncHandler(webhook));

// Routes protégées (paiement)
// ✅ Rate limiting sur le checkout uniquement
router.post(
  "/checkout",
  authMiddleware,
  checkoutLimiter,
  asyncHandler(checkout)
);
router.get("/me", authMiddleware, asyncHandler(listMine));
router.get("/seller/me/export", authMiddleware, asyncHandler(exportSellerInvoicesPdf));
router.get("/seller/me", authMiddleware, asyncHandler(listSellerMine));
router.get("/order/:orderId", authMiddleware, asyncHandler(getOneByOrder));

// Stripe Connect (onboarding pro)
router.post("/connect/onboard", authMiddleware, asyncHandler(onboardConnect));
router.post("/connect/disconnect", authMiddleware, asyncHandler(disconnectConnect));
router.get("/connect/status", authMiddleware, asyncHandler(connectStatus));

// Stripe Customer (buyer) — cartes enregistrées
router.post(
  "/customer/setup-intent",
  authMiddleware,
  asyncHandler(setupIntent)
);
router.get(
  "/customer/payment-methods",
  authMiddleware,
  asyncHandler(myPaymentMethods)
);
router.delete(
  "/customer/payment-methods/:id",
  authMiddleware,
  asyncHandler(deletePaymentMethod)
);

router.post(
  "/customer/payment-methods/:id/allow-redisplay",
  authMiddleware,
  asyncHandler(setRedisplay)
);

router.patch(
  "/customer/payment-methods/:id",
  authMiddleware,
  asyncHandler(updatePaymentMethodHandler)
);

export default router;
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  stats as buyerStats,
  recentOrders as buyerRecentOrders,
  recentRefunds as buyerRecentRefunds,
  invoices as buyerInvoices,
  resendInvoice as buyerResendInvoice,
  spendingChart as buyerSpendingChart,
} from "./buyer/buyer.controller";

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ============================================================
// BUYER
// ============================================================

router.get("/buyer/stats", asyncHandler(buyerStats));
router.get("/buyer/recent-orders", asyncHandler(buyerRecentOrders));
router.get("/buyer/recent-refunds", asyncHandler(buyerRecentRefunds));
router.get("/buyer/invoices", asyncHandler(buyerInvoices));
router.post(
  "/buyer/invoices/:orderId/resend",
  asyncHandler(buyerResendInvoice)
);
router.get("/buyer/spending-chart", asyncHandler(buyerSpendingChart));

export default router;
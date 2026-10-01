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
import {
  stats as sellerStats,
  ordersBreakdown as sellerOrdersBreakdown,
  revenueChart as sellerRevenueChart,
  topProducts as sellerTopProducts,
  ratings as sellerRatings,
  recentReviews as sellerRecentReviews,
  recentOrders as sellerRecentOrders,
} from "./seller/seller.controller";

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

// ============================================================
// SELLER
// ============================================================

router.get("/seller/stats", asyncHandler(sellerStats));
router.get(
  "/seller/orders-breakdown",
  asyncHandler(sellerOrdersBreakdown)
);
router.get("/seller/revenue-chart", asyncHandler(sellerRevenueChart));
router.get("/seller/top-products", asyncHandler(sellerTopProducts));
router.get("/seller/ratings", asyncHandler(sellerRatings));
router.get("/seller/recent-reviews", asyncHandler(sellerRecentReviews));
router.get("/seller/recent-orders", asyncHandler(sellerRecentOrders));

export default router;
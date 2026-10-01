import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
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
  verification as sellerVerification,
} from "./seller/seller.controller";
import {
  stats as adminStats,
  recentUsers as adminRecentUsers,
  recentOrders as adminRecentOrders,
  revenueChart as adminRevenueChart,
  moderation as adminModeration,
  pendingRefunds as adminPendingRefunds,
  kycSummary as adminKycSummary,
} from "./admin/admin.controller";

const router = Router();

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
router.get("/seller/verification", asyncHandler(sellerVerification));

// ============================================================
// ADMIN
// ============================================================

router.get(
  "/admin/stats",
  requireRole("admin"),
  asyncHandler(adminStats)
);
router.get(
  "/admin/recent-users",
  requireRole("admin"),
  asyncHandler(adminRecentUsers)
);
router.get(
  "/admin/recent-orders",
  requireRole("admin"),
  asyncHandler(adminRecentOrders)
);
router.get(
  "/admin/revenue-chart",
  requireRole("admin"),
  asyncHandler(adminRevenueChart)
);
router.get(
  "/admin/moderation",
  requireRole("admin"),
  asyncHandler(adminModeration)
);
router.get(
  "/admin/pending-refunds",
  requireRole("admin"),
  asyncHandler(adminPendingRefunds)
);
router.get(
  "/admin/kyc-summary",
  requireRole("admin"),
  asyncHandler(adminKycSummary)
);

export default router;
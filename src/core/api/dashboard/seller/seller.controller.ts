import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import { chartPeriodSchema } from "../dashboard.validation";
import {
  getSellerStats,
  getSellerOrdersBreakdown,
  getSellerRevenueChart,
  getTopProducts,
  getSellerRatings,
  getRecentReviews,
  getRecentOrdersToTreat,
} from "./seller.service";

// ============================================================
// GET /dashboard/seller/stats
// ============================================================

export async function stats(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const result = await getSellerStats(req.user.id);

  return res.json({ success: true, ...result });
}

// ============================================================
// GET /dashboard/seller/orders-breakdown
// ============================================================

export async function ordersBreakdown(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const breakdown = await getSellerOrdersBreakdown(req.user.id);

  return res.json({ success: true, breakdown });
}

// ============================================================
// GET /dashboard/seller/revenue-chart
// ============================================================

export async function revenueChart(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = chartPeriodSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const chart = await getSellerRevenueChart(
    req.user.id,
    parsed.data.months
  );

  return res.json({
    success: true,
    months: parsed.data.months,
    chart,
  });
}

// ============================================================
// GET /dashboard/seller/top-products
// ============================================================

export async function topProducts(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const list = await getTopProducts(req.user.id);

  return res.json({
    success: true,
    count: list.length,
    products: list,
  });
}

// ============================================================
// GET /dashboard/seller/ratings
// ============================================================

export async function ratings(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const result = await getSellerRatings(req.user.id);

  return res.json({ success: true, ...result });
}

// ============================================================
// GET /dashboard/seller/recent-reviews
// ============================================================

export async function recentReviews(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const list = await getRecentReviews(req.user.id);

  return res.json({
    success: true,
    count: list.length,
    reviews: list,
  });
}

// ============================================================
// GET /dashboard/seller/recent-orders
// ============================================================

export async function recentOrders(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const list = await getRecentOrdersToTreat(req.user.id);

  return res.json({
    success: true,
    count: list.length,
    orders: list,
  });
}
import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import { chartPeriodSchema } from "../dashboard.validation";
import {
  getAdminStats,
  getRecentUsers,
  getRecentOrders,
  getRevenueChart,
  getModerationList,
  getPendingRefunds,
  getKycSummaryForDashboard,
  getAdminSummary,
} from "./admin.service";

// ============================================================
// GET /dashboard/admin/stats
// ============================================================

export async function stats(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await getAdminStats();
  return res.json({ success: true, ...result });
}

// ============================================================
// GET /dashboard/admin/recent-users
// ============================================================

export async function recentUsers(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getRecentUsers(50);
  return res.json({ success: true, count: list.length, users: list });
}

// ============================================================
// GET /dashboard/admin/recent-orders
// ============================================================

export async function recentOrders(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getRecentOrders(50);
  return res.json({ success: true, count: list.length, orders: list });
}

// ============================================================
// GET /dashboard/admin/revenue-chart
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

  const chart = await getRevenueChart(parsed.data.months);
  return res.json({ success: true, months: parsed.data.months, chart });
}

// ============================================================
// GET /dashboard/admin/moderation
// ============================================================

export async function moderation(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getModerationList();
  return res.json({ success: true, count: list.length, reviews: list });
}

// ============================================================
// GET /dashboard/admin/pending-refunds
// ============================================================

export async function pendingRefunds(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getPendingRefunds(50);
  return res.json({ success: true, count: list.length, refunds: list });
}

// ============================================================
// GET /dashboard/admin/kyc-summary
// ============================================================

export async function kycSummary(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await getKycSummaryForDashboard();
  return res.json({ success: true, ...result });
}

// ============================================================
// GET /dashboard/admin/summary
// ============================================================

export async function summary(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await getAdminSummary();
  return res.json({ success: true, ...result });
}
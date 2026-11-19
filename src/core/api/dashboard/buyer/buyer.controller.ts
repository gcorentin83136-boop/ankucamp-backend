import { Response } from "express";
import { AuthRequest } from "../../../middlewares/auth.middleware";
import { AppError } from "../../../errors/AppError";
import { chartPeriodSchema } from "../dashboard.validation";
import {
  getBuyerStats,
  getRecentOrders,
  getRecentRefunds,
  getMyInvoices,
  resendMyInvoice,
  getSpendingChart,
  getBuyerSummary,
} from "./buyer.service";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

// ============================================================
// GET /dashboard/buyer/stats
// ============================================================

export async function stats(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await getBuyerStats(req.user.id);
  return res.json({ success: true, ...result });
}

// ============================================================
// GET /dashboard/buyer/recent-orders
// ============================================================

export async function recentOrders(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getRecentOrders(req.user.id);
  return res.json({ success: true, count: list.length, orders: list });
}

// ============================================================
// GET /dashboard/buyer/recent-refunds
// ============================================================

export async function recentRefunds(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getRecentRefunds(req.user.id);
  return res.json({ success: true, count: list.length, refunds: list });
}

// ============================================================
// GET /dashboard/buyer/invoices
// ============================================================

export async function invoices(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getMyInvoices(req.user.id);
  return res.json({ success: true, count: list.length, invoices: list });
}

// ============================================================
// POST /dashboard/buyer/invoices/:orderId/resend
// ============================================================

export async function resendInvoice(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const orderId = parseId(req.params.orderId);
  const result = await resendMyInvoice(req.user.id, orderId);
  return res.json({
    success: true,
    message: `Facture renvoyée à ${result.email}`,
    email: result.email,
  });
}

// ============================================================
// GET /dashboard/buyer/spending-chart
// ============================================================

export async function spendingChart(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = chartPeriodSchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const chart = await getSpendingChart(req.user.id, parsed.data.months);
  return res.json({ success: true, months: parsed.data.months, chart });
}

// ============================================================
// GET /dashboard/buyer/summary
// ============================================================

export async function summary(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await getBuyerSummary(req.user.id);
  return res.json({ success: true, ...result });
}
import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  requestRefundSchema,
  processRefundSchema,
  listRefundsQuerySchema,
} from "./refunds.validation";
import {
  requestRefund,
  getMyRefunds,
  getAllRefunds,
  getRefundById,
  approveRefund,
  rejectRefund,
} from "./refunds.service";
import { logAdminActionAsync } from "../audit/audit.helper";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

// ============================================================
// POST /refunds/request (buyer)
// ============================================================

export async function request(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = requestRefundSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const refund = await requestRefund(req.user.id, parsed.data);

  return res.status(201).json({
    success: true,
    message: "Demande de remboursement envoyée. Un admin va la traiter.",
    refund,
  });
}

// ============================================================
// GET /refunds/me (buyer)
// ============================================================

export async function listMine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const refunds = await getMyRefunds(req.user.id);

  return res.json({
    success: true,
    count: refunds.length,
    refunds,
  });
}

// ============================================================
// GET /refunds (admin)
// ============================================================

export async function listAll(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listRefundsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const refunds = await getAllRefunds(parsed.data);

  return res.json({
    success: true,
    count: refunds.length,
    refunds,
  });
}

// ============================================================
// GET /refunds/:id (buyer ou admin)
// ============================================================

export async function getOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const refundId = parseId(req.params.id);

  const refund = await getRefundById(refundId, req.user.id, req.user.role);

  return res.json({
    success: true,
    refund,
  });
}

// ============================================================
// PUT /refunds/:id/approve (admin)
// ============================================================

export async function approve(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const refundId = parseId(req.params.id);

  const parsed = processRefundSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await approveRefund(
    refundId,
    req.user.id,
    parsed.data.admin_comment
  );

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "refund_approve",
    targetType: "refund",
    targetId: refundId,
    description: `Remboursement #${refundId} approuvé et effectué via Stripe`,
    metadata: {
      admin_comment: parsed.data.admin_comment ?? null,
      result,
    },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json({
    success: true,
    message: "Remboursement approuvé et effectué via Stripe",
    ...result,
  });
}

// ============================================================
// PUT /refunds/:id/reject (admin)
// ============================================================

export async function reject(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const refundId = parseId(req.params.id);

  const parsed = processRefundSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await rejectRefund(
    refundId,
    req.user.id,
    parsed.data.admin_comment
  );

  // 📝 Audit log
  logAdminActionAsync({
    adminId: req.user.id,
    action: "refund_reject",
    targetType: "refund",
    targetId: refundId,
    description: `Remboursement #${refundId} rejeté`,
    metadata: { admin_comment: parsed.data.admin_comment ?? null },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  return res.json({
    success: true,
    message: "Demande de remboursement rejetée",
    ...result,
  });
}
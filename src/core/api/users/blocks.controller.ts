// ============================================================
// ANKU — Controllers Blocage / Restriction
// ============================================================
import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  blockUser,
  unblockUser,
  restrictUser,
  unrestrictUser,
  listBlocked,
  listRestricted,
  isBlocked,
  isRestricted,
} from "./blocks.service";

// ============================================================
// BLOCAGE
// ============================================================

export async function postBlock(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    throw new AppError("ID invalide", 400);
  }
  const result = await blockUser(req.user.id, targetId);
  return res.json(result);
}

export async function deleteBlock(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    throw new AppError("ID invalide", 400);
  }
  const result = await unblockUser(req.user.id, targetId);
  return res.json(result);
}

// ============================================================
// RESTRICTION
// ============================================================

export async function postRestrict(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    throw new AppError("ID invalide", 400);
  }
  const result = await restrictUser(req.user.id, targetId);
  return res.json(result);
}

export async function deleteRestrict(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    throw new AppError("ID invalide", 400);
  }
  const result = await unrestrictUser(req.user.id, targetId);
  return res.json(result);
}

// ============================================================
// LECTURE
// ============================================================

export async function getMyBlocked(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await listBlocked(req.user.id);
  return res.json({ success: true, count: list.length, blocked: list });
}

export async function getMyRestricted(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await listRestricted(req.user.id);
  return res.json({ success: true, count: list.length, restricted: list });
}

// ============================================================
// STATUS (pour le profil)
// ============================================================

export async function getBlockStatus(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const targetId = Number(req.params.id);
  if (!Number.isFinite(targetId)) {
    throw new AppError("ID invalide", 400);
  }
  const [blocked, restricted] = await Promise.all([
    isBlocked(req.user.id, targetId),
    isRestricted(req.user.id, targetId),
  ]);
  return res.json({
    success: true,
    is_blocked: blocked,
    is_restricted: restricted,
  });
}
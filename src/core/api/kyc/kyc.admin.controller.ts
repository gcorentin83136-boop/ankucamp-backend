import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { listKycQuerySchema, rejectKycSchema } from "./kyc.validation";
import {
  listKycRequests,
  getKycRequestById,
  approveKycRequest,
  rejectKycRequest,
  getKycStats,
} from "./kyc.service";
import { grantBadge } from "../badges/badges.service";

const TYPE_TO_BADGE: Record<string, "agriculteur" | "artisan" | "createur"> = {
  agriculteur: "agriculteur",
  artisan: "artisan",
  createur: "createur",
};

export async function adminListKyc(req: AuthRequest, res: Response) {
  const parsed = listKycQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Query invalide",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const requests = await listKycRequests(parsed.data);
  return res.json({ success: true, requests });
}

export async function adminGetKyc(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
  const request = await getKycRequestById(id);
  return res.json({ success: true, request });
}

export async function adminApproveKyc(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const result = await approveKycRequest(id, req.user.id);

  await grantBadge(result.user_id, "verified", req.user.id).catch(() => {});

  const specific = TYPE_TO_BADGE[result.type];
  if (specific) {
    await grantBadge(result.user_id, specific, req.user.id).catch(() => {});
  }

  return res.json({ success: true, user_id: result.user_id });
}

export async function adminRejectKyc(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = rejectKycSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Donnees invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await rejectKycRequest(id, req.user.id, parsed.data.reason);
  return res.json({ success: true, user_id: result.user_id });
}

export async function adminKycStats(_req: AuthRequest, res: Response) {
  const stats = await getKycStats();
  return res.json({ success: true, stats });
}
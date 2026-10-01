import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createKycSchema } from "./kyc.validation";
import {
  createKycRequest,
  getMyLastKycRequest,
  cancelMyKycRequest,
} from "./kyc.service";

export async function postKycRequest(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);

  const parsed = createKycSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Donnees invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const created = await createKycRequest(req.user.id, parsed.data);
  return res.status(201).json({ success: true, request: created });
}

export async function getMyKyc(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const request = await getMyLastKycRequest(req.user.id);
  return res.json({ success: true, request });
}

export async function deleteMyKyc(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const result = await cancelMyKycRequest(req.user.id);
  return res.json(result);
}
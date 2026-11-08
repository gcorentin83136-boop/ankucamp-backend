import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import * as reelsService from "./reels.service";

export async function getFeed(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const reels = await reelsService.getReelsFeed(req.user.id);
  return res.json({ success: true, reels });
}

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const reel = await reelsService.createReel(req.user.id, req.body);
  return res.status(201).json({ success: true, reel });
}

export async function like(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await reelsService.toggleLike(Number(req.params.id), req.user.id);
  return res.json({ success: true, ...result });
}
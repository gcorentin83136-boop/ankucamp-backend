import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import * as storiesService from "./stories.service";

export async function getFeed(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const stories = await storiesService.getStoriesFeed(req.user.id);
  return res.json({ success: true, stories }); // Note: on renvoie "stories" et non plus "reels"
}

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const story = await storiesService.createStory(req.user.id, req.body);
  return res.status(201).json({ success: true, story });
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const result = await storiesService.deleteStory(Number(req.params.id), req.user.id);
  return res.json(result);
}
export async function updateVisibilityCtrl(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const story = await storiesService.updateVisibility(Number(req.params.id), req.user.id, req.body.visibility);
  return res.json({ success: true, story });
}
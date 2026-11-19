import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { createStory, getStoriesFeed, updateVisibility, deleteStory } from "./stories.service";

function parseId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const story = await createStory(req.user.id, req.body);
  return res.status(201).json({ success: true, story });
}

export async function feed(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const groups = await getStoriesFeed(req.user.id);
  return res.json({ success: true, stories: groups });
}

export async function updateStoryVisibility(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const storyId = parseId(req.params.id);
  const { visibility } = req.body;
  const story = await updateVisibility(storyId, req.user.id, visibility);
  return res.json({ success: true, story });
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const storyId = parseId(req.params.id);
  await deleteStory(storyId, req.user.id);
  return res.status(204).send();
}
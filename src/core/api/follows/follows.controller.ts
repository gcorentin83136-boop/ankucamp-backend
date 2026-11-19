import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { listFollowsQuerySchema } from "./follows.validation";
import {
  toggleFollow,
  isFollowing,
  listMyFollows,
  listShopFollowers,
  getShopFollowersCount,
  getMyFollowsCount,
} from "./follows.service";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

// ============================================================
// TOGGLE FOLLOW
// ============================================================

export async function toggle(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);

  const result = await toggleFollow(shopId, req.user.id);

  return res.json({
    success: true,
    message: result.following ? "Boutique suivie" : "Boutique retirée",
    following: result.following,
  });
}

// ============================================================
// MES FOLLOWS
// ============================================================

export async function mine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listFollowsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const list = await listMyFollows(req.user.id, parsed.data);

  return res.json({ success: true, count: list.length, follows: list });
}

export async function count(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const c = await getMyFollowsCount(req.user.id);

  return res.json({ success: true, count: c });
}

// ============================================================
// FOLLOWERS D'UNE BOUTIQUE
// ============================================================

export async function shopFollowers(req: AuthRequest, res: Response) {
  const shopId = parseId(req.params.shopId);

  const parsed = listFollowsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const list = await listShopFollowers(shopId, parsed.data);

  return res.json({ success: true, count: list.length, followers: list });
}

export async function shopFollowersCount(req: AuthRequest, res: Response) {
  const shopId = parseId(req.params.shopId);

  const c = await getShopFollowersCount(shopId);

  return res.json({ success: true, count: c });
}

// ============================================================
// STATUT
// ============================================================

export async function status(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const shopId = parseId(req.params.shopId);

  const following = await isFollowing(shopId, req.user.id);

  return res.json({ success: true, following });
}
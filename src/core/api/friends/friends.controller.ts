import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { listFriendsQuerySchema } from "./friends.validation";
import {
  getRelationStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  listFriends,
  listReceivedRequests,
  listSentRequests,
  getFriendStats,
} from "./friends.service";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

// ============================================================
// DEMANDES
// ============================================================

export async function sendRequest(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const receiverId = parseId(req.params.userId);

  const rel = await sendFriendRequest(req.user.id, receiverId);

  return res.status(201).json({
    success: true,
    message: "Demande d'ami envoyée",
    friendship: rel,
  });
}

export async function accept(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const requestId = parseId(req.params.id);

  const rel = await acceptFriendRequest(requestId, req.user.id);

  return res.json({
    success: true,
    message: "Demande acceptée",
    friendship: rel,
  });
}

export async function decline(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const requestId = parseId(req.params.id);

  await declineFriendRequest(requestId, req.user.id);

  return res.json({ success: true, message: "Demande refusée" });
}

export async function cancel(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const requestId = parseId(req.params.id);

  await cancelFriendRequest(requestId, req.user.id);

  return res.json({ success: true, message: "Demande annulée" });
}

// ============================================================
// AMIS
// ============================================================

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const friendUserId = parseId(req.params.userId);

  await removeFriend(friendUserId, req.user.id);

  return res.status(204).send();
}

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listFriendsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const friends = await listFriends(req.user.id, parsed.data);

  return res.json({ success: true, count: friends.length, friends });
}

export async function receivedRequests(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listFriendsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const list = await listReceivedRequests(req.user.id, parsed.data);

  return res.json({ success: true, count: list.length, requests: list });
}

export async function sentRequests(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listFriendsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const list = await listSentRequests(req.user.id, parsed.data);

  return res.json({ success: true, count: list.length, requests: list });
}

// ============================================================
// STATUT & STATS
// ============================================================

export async function status(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const targetUserId = parseId(req.params.userId);

  const rel = await getRelationStatus(req.user.id, targetUserId);

  return res.json({ success: true, ...rel });
}

export async function stats(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const s = await getFriendStats(req.user.id);

  return res.json({ success: true, ...s });
}
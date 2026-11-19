import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import {
  getPostOpenGraph,
  getUserOpenGraph,
  getShopOpenGraph,
  getPostShareLinks,
  getUserShareLinks,
  getShopShareLinks,
} from "./share.service";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

// ============================================================
// OPEN GRAPH
// ============================================================

export async function postOG(req: Request, res: Response) {
  const postId = parseId(req.params.id);
  const og = await getPostOpenGraph(postId);
  return res.json({ success: true, og });
}

export async function userOG(req: Request, res: Response) {
  const { username } = req.params;
  if (!username) throw new AppError("Username requis", 400);
  const og = await getUserOpenGraph(username);
  return res.json({ success: true, og });
}

export async function shopOG(req: Request, res: Response) {
  const shopId = parseId(req.params.id);
  const og = await getShopOpenGraph(shopId);
  return res.json({ success: true, og });
}

// ============================================================
// LIENS DE PARTAGE
// ============================================================

export async function postShareLinks(req: Request, res: Response) {
  const postId = parseId(req.params.id);
  const result = await getPostShareLinks(postId);
  return res.json({ success: true, ...result });
}

export async function userShareLinks(req: Request, res: Response) {
  const { username } = req.params;
  if (!username) throw new AppError("Username requis", 400);
  const result = await getUserShareLinks(username);
  return res.json({ success: true, ...result });
}

export async function shopShareLinks(req: Request, res: Response) {
  const shopId = parseId(req.params.id);
  const result = await getShopShareLinks(shopId);
  return res.json({ success: true, ...result });
}
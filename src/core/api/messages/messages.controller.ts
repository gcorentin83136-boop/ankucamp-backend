import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
  createPublicMessageSchema,
  createGroupMessageSchema,
  createSupportMessageSchema,
} from "./messages.validation";
import {
  getPublicMessages,
  createPublicMessage,
  getGroupMessages,
  createGroupMessage,
  getSupportMessagesByUser,
  getSupportMessagesByShop,
  createSupportMessage,
  getMessageById,
} from "./messages.service";

// PUBLIC
export async function listPublic(_req: Request, res: Response) {
  const list = await getPublicMessages();
  return res.json({ success: true, messages: list });
}

export async function createPublic(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const parsed = createPublicMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Données invalides", errors: parsed.error.flatten().fieldErrors });
  }

  const message = await createPublicMessage(req.user.id, parsed.data.content);
  return res.status(201).json({ success: true, message });
}

// GROUP
export async function listGroup(req: AuthRequest, res: Response) {
  const groupId = Number(req.params.groupId);
  if (isNaN(groupId)) return res.status(400).json({ success: false, message: "groupId invalide" });

  const list = await getGroupMessages(groupId);
  return res.json({ success: true, messages: list });
}

export async function createGroup(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const parsed = createGroupMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Données invalides", errors: parsed.error.flatten().fieldErrors });
  }

  const message = await createGroupMessage(req.user.id, parsed.data.group_id, parsed.data.content);
  return res.status(201).json({ success: true, message });
}

// SUPPORT
export async function listSupportMine(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const list = await getSupportMessagesByUser(req.user.id);
  return res.json({ success: true, messages: list });
}

export async function listSupportByShop(req: AuthRequest, res: Response) {
  const shopId = Number(req.params.shopId);
  if (isNaN(shopId)) return res.status(400).json({ success: false, message: "shopId invalide" });

  const list = await getSupportMessagesByShop(shopId);
  return res.json({ success: true, messages: list });
}

export async function createSupport(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const parsed = createSupportMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Données invalides", errors: parsed.error.flatten().fieldErrors });
  }

  const message = await createSupportMessage(req.user.id, parsed.data.receiver_id, parsed.data.content);
  return res.status(201).json({ success: true, message });
}

// PAR ID
export async function getOne(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "ID invalide" });

  const message = await getMessageById(id);
  if (!message) return res.status(404).json({ success: false, message: "Message introuvable" });

  return res.json({ success: true, message });
}
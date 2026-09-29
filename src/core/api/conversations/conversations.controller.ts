import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createConversationSchema,
  updateConversationSchema,
  addParticipantSchema,
  sendMessageSchema,
  editMessageSchema,
  markAsReadSchema,
  reactToMessageSchema,
  listMessagesQuerySchema,
} from "./conversations.validation";
import {
  getUserConversations,
  getConversationById,
  createConversation,
  updateConversation,
  deleteConversation,
  leaveConversation,
  addParticipant,
  removeParticipant,
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  toggleReaction,
} from "./conversations.service";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

// ============================================================
// GET /conversations
// ============================================================

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const list = await getUserConversations(req.user.id);

  return res.json({ success: true, count: list.length, conversations: list });
}

// ============================================================
// GET /conversations/:id
// ============================================================

export async function getOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);
  const conversation = await getConversationById(id, req.user.id);

  return res.json({ success: true, conversation });
}

// ============================================================
// POST /conversations
// ============================================================

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const conversation = await createConversation(req.user.id, parsed.data);

  return res.status(201).json({
    success: true,
    message: "Conversation créée",
    conversation,
  });
}

// ============================================================
// PUT /conversations/:id
// ============================================================

export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);

  const parsed = updateConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const conversation = await updateConversation(id, req.user.id, parsed.data);

  return res.json({ success: true, conversation });
}

// ============================================================
// DELETE /conversations/:id
// ============================================================

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);
  await deleteConversation(id, req.user.id);

  return res.status(204).send();
}

// ============================================================
// POST /conversations/:id/leave
// ============================================================

export async function leave(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);
  await leaveConversation(id, req.user.id);

  return res.json({ success: true, message: "Tu as quitté la conversation" });
}

// ============================================================
// POST /conversations/:id/participants
// ============================================================

export async function addPart(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);

  const parsed = addParticipantSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  await addParticipant(id, req.user.id, parsed.data.user_id);

  return res.status(201).json({
    success: true,
    message: "Participant ajouté",
  });
}

// ============================================================
// DELETE /conversations/:id/participants/:userId
// ============================================================

export async function removePart(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);
  const targetId = parseId(req.params.userId);

  await removeParticipant(id, req.user.id, targetId);

  return res.json({ success: true, message: "Participant retiré" });
}

// ============================================================
// GET /conversations/:id/messages
// ============================================================

export async function listMessages(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);

  const parsed = listMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const messages = await getMessages(id, req.user.id, parsed.data);

  return res.json({ success: true, count: messages.length, messages });
}

// ============================================================
// POST /conversations/:id/messages
// ============================================================

export async function postMessage(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const message = await sendMessage(id, req.user.id, parsed.data);

  return res.status(201).json({ success: true, message });
}

// ============================================================
// POST /conversations/:id/read
// ============================================================

export async function read(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = parseId(req.params.id);

  const parsed = markAsReadSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await markAsRead(id, req.user.id, parsed.data.until_message_id);

  return res.json({ success: true, ...result });
}

// ============================================================
// PUT /messages/:messageId
// ============================================================

export async function editMsg(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const messageId = parseId(req.params.messageId);

  const parsed = editMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const message = await editMessage(messageId, req.user.id, parsed.data.content);

  return res.json({ success: true, message });
}

// ============================================================
// DELETE /messages/:messageId
// ============================================================

export async function deleteMsg(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const messageId = parseId(req.params.messageId);
  await deleteMessage(messageId, req.user.id);

  return res.status(204).send();
}

// ============================================================
// POST /messages/:messageId/reactions
// ============================================================

export async function react(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const messageId = parseId(req.params.messageId);

  const parsed = reactToMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await toggleReaction(messageId, req.user.id, parsed.data.emoji);

  return res.json({ success: true, ...result });
}
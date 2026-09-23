import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "./notifications.service";

export async function listMine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getNotificationsForUser(req.user.id);
  return res.json({ success: true, notifications: list });
}

export async function markRead(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  const notif = await markNotificationAsRead(id, req.user.id);
  return res.json({
    success: true,
    message: "Notification marquée comme lue",
    notification: notif,
  });
}

export async function markAllRead(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const updated = await markAllNotificationsAsRead(req.user.id);
  return res.json({
    success: true,
    message: `${updated.length} notification(s) marquée(s) comme lue(s)`,
    count: updated.length,
  });
}

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const id = Number(req.params.id);
  if (isNaN(id)) throw new AppError("ID invalide", 400);

  await deleteNotification(id, req.user.id);
  return res.status(204).send();
}
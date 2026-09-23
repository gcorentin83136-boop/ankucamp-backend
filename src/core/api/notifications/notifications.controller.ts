import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "./notifications.service";

export async function listMine(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const list = await getNotificationsForUser(req.user.id);
  return res.json({ success: true, notifications: list });
}

export async function markRead(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "ID invalide" });

  try {
    const notif = await markNotificationAsRead(id, req.user.id);
    return res.json({ success: true, message: "Notification marquée comme lue", notification: notif });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return res.status(404).json({ success: false, message });
  }
}

export async function markAllRead(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const updated = await markAllNotificationsAsRead(req.user.id);
  return res.json({
    success: true,
    message: `${updated.length} notification(s) marquée(s) comme lue(s)`,
    count: updated.length,
  });
}

export async function deleteOne(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Non authentifié" });

  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, message: "ID invalide" });

  try {
    await deleteNotification(id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return res.status(404).json({ success: false, message });
  }
}
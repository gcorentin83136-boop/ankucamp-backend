import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { notifications } from "../../db/schema";

/**
 * Récupère toutes les notifications d'un utilisateur.
 */
export async function getNotificationsForUser(userId: number) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId));
}

/**
 * Récupère une notification par ID (avec vérif de propriété).
 */
export async function getNotificationById(id: number, userId: number) {
  const [notif] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)))
    .limit(1);

  return notif ?? null;
}

/**
 * Marque une notification comme lue.
 */
export async function markNotificationAsRead(id: number, userId: number) {
  const existing = await getNotificationById(id, userId);
  if (!existing) {
    throw new Error("Notification introuvable");
  }

  const [updated] = await db
    .update(notifications)
    .set({ is_read: 1 })
    .where(eq(notifications.id, id))
    .returning();

  return updated;
}

/**
 * Marque toutes les notifications de l'utilisateur comme lues.
 */
export async function markAllNotificationsAsRead(userId: number) {
  const result = await db
    .update(notifications)
    .set({ is_read: 1 })
    .where(eq(notifications.user_id, userId))
    .returning();

  return result;
}

/**
 * Supprime une notification.
 */
export async function deleteNotification(id: number, userId: number) {
  const existing = await getNotificationById(id, userId);
  if (!existing) {
    throw new Error("Notification introuvable");
  }

  await db.delete(notifications).where(eq(notifications.id, id));
}

/**
 * Créer une notification (utilisé par d'autres services, pas exposé en HTTP).
 */
export async function createNotification(
  userId: number,
  title: string,
  content: string
) {
  const [created] = await db
    .insert(notifications)
    .values({
      user_id: userId,
      title,
      content,
      is_read: 0,
    })
    .returning();

  return created;
}
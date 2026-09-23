import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { notifications } from "../../db/schema";
import { AppError } from "../../errors/AppError";

export async function getNotificationsForUser(userId: number) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId));
}

export async function getNotificationById(id: number, userId: number) {
  const [notif] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)))
    .limit(1);

  if (!notif) {
    throw new AppError("Notification introuvable", 404);
  }

  return notif;
}

export async function markNotificationAsRead(id: number, userId: number) {
  await getNotificationById(id, userId);

  const [updated] = await db
    .update(notifications)
    .set({ is_read: 1 })
    .where(eq(notifications.id, id))
    .returning();

  return updated;
}

export async function markAllNotificationsAsRead(userId: number) {
  const result = await db
    .update(notifications)
    .set({ is_read: 1 })
    .where(eq(notifications.user_id, userId))
    .returning();

  return result;
}

export async function deleteNotification(id: number, userId: number) {
  await getNotificationById(id, userId);
  await db.delete(notifications).where(eq(notifications.id, id));
}

export async function createNotification(
  userId: number,
  title: string,
  content: string
) {
  const [created] = await db
    .insert(notifications)
    .values({ user_id: userId, title, content, is_read: 0 })
    .returning();

  return created;
}
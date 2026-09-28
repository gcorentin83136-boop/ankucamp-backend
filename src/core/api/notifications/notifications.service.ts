import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { notifications } from "../../db/schema";
import { AppError } from "../../errors/AppError";

// ============================================================
// LECTURE
// ============================================================

/**
 * Liste les notifications d'un utilisateur (triées récentes en premier).
 */
export async function getNotificationsForUser(
  userId: number,
  limit: number = 50,
  offset: number = 0
) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(desc(notifications.created_at))
    .limit(limit)
    .offset(offset);
}

/**
 * Retourne le nombre de notifications non lues.
 * Utile pour le badge dans le front.
 */
export async function getUnreadCount(userId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, 0)));

  return result[0]?.count ?? 0;
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

// ============================================================
// MISE À JOUR
// ============================================================

export async function markNotificationAsRead(id: number, userId: number) {
  await getNotificationById(id, userId);

  const [updated] = await db
    .update(notifications)
    .set({ is_read: 1, read_at: new Date() })
    .where(eq(notifications.id, id))
    .returning();

  return updated;
}

export async function markAllNotificationsAsRead(userId: number) {
  const result = await db
    .update(notifications)
    .set({ is_read: 1, read_at: new Date() })
    .where(
      and(eq(notifications.user_id, userId), eq(notifications.is_read, 0))
    )
    .returning();

  return result;
}

// ============================================================
// SUPPRESSION
// ============================================================

export async function deleteNotification(id: number, userId: number) {
  await getNotificationById(id, userId);
  await db.delete(notifications).where(eq(notifications.id, id));
}

// ============================================================
// CRÉATION
// ============================================================

export interface CreateNotificationInput {
  userId: number;
  type: string; // 'order', 'review', 'message', 'system'
  title: string;
  content: string;
  link?: string | null;
  data?: Record<string, unknown> | null;
}

/**
 * Crée une notification. Retourne l'objet créé.
 *
 * Note : préfère utiliser le helper `notify()` depuis
 * `src/core/notifications/notifications.helper.ts` qui est plus concis.
 */
export async function createNotification(input: CreateNotificationInput) {
  const { userId, type, title, content, link, data } = input;

  const [created] = await db
    .insert(notifications)
    .values({
      user_id: userId,
      type,
      title,
      content,
      link: link ?? null,
      data: data ? JSON.stringify(data) : null,
      is_read: 0,
    })
    .returning();

  return created;
}
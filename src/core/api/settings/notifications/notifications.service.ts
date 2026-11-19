import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { userSettings } from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import type {
  EmailPrefsInput,
  PushPrefsInput,
  AllNotificationsInput,
} from "./notifications.validation";

// ============================================================
// HELPERS PRIVÉS
// ============================================================

async function getOrCreateSettings(userId: number) {
  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.user_id, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(userSettings)
    .values({ user_id: userId })
    .returning();

  console.log(`⚙️  Settings créés (lazy) pour user #${userId}`);
  return created;
}

function boolToInt(value: boolean | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value ? 1 : 0;
}

function formatSettings(settings: any) {
  return {
    email: {
      order_updates: settings.email_order_updates === 1,
      new_messages: settings.email_new_messages === 1,
      social_activity: settings.email_social_activity === 1,
      marketing: settings.email_marketing === 1,
    },
    push: {
      order_updates: settings.push_order_updates === 1,
      new_messages: settings.push_new_messages === 1,
      social_activity: settings.push_social_activity === 1,
    },
    // 🆕 Messagerie
    messaging: {
      notification_sound: settings.notification_sound === 1,
      call_ringtone: settings.call_ringtone,
    },
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function getNotifications(userId: number) {
  const settings = await getOrCreateSettings(userId);
  return formatSettings(settings);
}

// ============================================================
// MISE À JOUR
// ============================================================

export async function updateAllNotifications(
  userId: number,
  input: AllNotificationsInput
) {
  await getOrCreateSettings(userId);

  const updates: any = { updated_at: new Date() };

  if (input.email_order_updates !== undefined)
    updates.email_order_updates = boolToInt(input.email_order_updates);
  if (input.email_new_messages !== undefined)
    updates.email_new_messages = boolToInt(input.email_new_messages);
  if (input.email_social_activity !== undefined)
    updates.email_social_activity = boolToInt(input.email_social_activity);
  if (input.email_marketing !== undefined)
    updates.email_marketing = boolToInt(input.email_marketing);

  if (input.push_order_updates !== undefined)
    updates.push_order_updates = boolToInt(input.push_order_updates);
  if (input.push_new_messages !== undefined)
    updates.push_new_messages = boolToInt(input.push_new_messages);
  if (input.push_social_activity !== undefined)
    updates.push_social_activity = boolToInt(input.push_social_activity);

  // 🆕 Messagerie
  if (input.notification_sound !== undefined)
    updates.notification_sound = boolToInt(input.notification_sound);
  if (input.call_ringtone !== undefined)
    updates.call_ringtone = input.call_ringtone;

  const [updated] = await db
    .update(userSettings)
    .set(updates)
    .where(eq(userSettings.user_id, userId))
    .returning();

  console.log(`🔔 Notifications mises à jour pour user #${userId}`);

  return formatSettings(updated);
}

export async function updateEmailPrefs(
  userId: number,
  input: EmailPrefsInput
) {
  await getOrCreateSettings(userId);

  const updates: any = { updated_at: new Date() };
  if (input.email_order_updates !== undefined)
    updates.email_order_updates = boolToInt(input.email_order_updates);
  if (input.email_new_messages !== undefined)
    updates.email_new_messages = boolToInt(input.email_new_messages);
  if (input.email_social_activity !== undefined)
    updates.email_social_activity = boolToInt(input.email_social_activity);
  if (input.email_marketing !== undefined)
    updates.email_marketing = boolToInt(input.email_marketing);

  const [updated] = await db
    .update(userSettings)
    .set(updates)
    .where(eq(userSettings.user_id, userId))
    .returning();

  console.log(`📧 Prefs email mises à jour pour user #${userId}`);

  return formatSettings(updated);
}

export async function updatePushPrefs(
  userId: number,
  input: PushPrefsInput
) {
  await getOrCreateSettings(userId);

  const updates: any = { updated_at: new Date() };
  if (input.push_order_updates !== undefined)
    updates.push_order_updates = boolToInt(input.push_order_updates);
  if (input.push_new_messages !== undefined)
    updates.push_new_messages = boolToInt(input.push_new_messages);
  if (input.push_social_activity !== undefined)
    updates.push_social_activity = boolToInt(input.push_social_activity);

  const [updated] = await db
    .update(userSettings)
    .set(updates)
    .where(eq(userSettings.user_id, userId))
    .returning();

  console.log(`📱 Prefs push mises à jour pour user #${userId}`);

  return formatSettings(updated);
}

// ============================================================
// EXPORT : utile pour les autres services (emails, notifs)
// ============================================================

export async function shouldSendEmail(
  userId: number,
  type: "order_updates" | "new_messages" | "social_activity" | "marketing"
): Promise<boolean> {
  const settings = await getOrCreateSettings(userId);

  switch (type) {
    case "order_updates":
      return settings.email_order_updates === 1;
    case "new_messages":
      return settings.email_new_messages === 1;
    case "social_activity":
      return settings.email_social_activity === 1;
    case "marketing":
      return settings.email_marketing === 1;
    default:
      return true;
  }
}

export async function shouldSendPush(
  userId: number,
  type: "order_updates" | "new_messages" | "social_activity"
): Promise<boolean> {
  const settings = await getOrCreateSettings(userId);

  switch (type) {
    case "order_updates":
      return settings.push_order_updates === 1;
    case "new_messages":
      return settings.push_new_messages === 1;
    case "social_activity":
      return settings.push_social_activity === 1;
    default:
      return true;
  }
}
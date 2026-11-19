import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { userSettings, users } from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import type {
  ProfileVisibilityInput,
  MessagesFromInput,
  PrivacyInput,
} from "./privacy.validation";

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

/**
 * Synchronise `users.is_private` avec `user_settings.profile_visibility`.
 */
async function syncIsPrivate(
  userId: number,
  profileVisibility: string
): Promise<void> {
  const isPrivate = profileVisibility === "private" ? 1 : 0;

  await db
    .update(users)
    .set({ is_private: isPrivate })
    .where(eq(users.id, userId));

  console.log(
    `🔒 Sync is_private = ${isPrivate} pour user #${userId} (visibilité: ${profileVisibility})`
  );
}

function boolToInt(value: boolean | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value ? 1 : 0;
}

function formatPrivacy(settings: any) {
  return {
    profile_visibility: settings.profile_visibility,
    allow_messages_from: settings.allow_messages_from,
    show_email: settings.show_email === 1,
    show_phone: settings.show_phone === 1,
    search_indexable: settings.search_indexable === 1,
    // 🆕 Messagerie avancée
    read_receipts: settings.read_receipts === 1,
    online_status_visibility: settings.online_status_visibility,
    typing_indicator: settings.typing_indicator === 1,
    call_permissions: settings.call_permissions,
    // 🆕 Notifications messagerie
    notification_sound: settings.notification_sound === 1,
    call_ringtone: settings.call_ringtone,
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function getPrivacy(userId: number) {
  const settings = await getOrCreateSettings(userId);
  return formatPrivacy(settings);
}

// ============================================================
// MISE À JOUR
// ============================================================

export async function updateAllPrivacy(
  userId: number,
  input: PrivacyInput
) {
  await getOrCreateSettings(userId);

  const updates: any = { updated_at: new Date() };

  // Profil
  if (input.profile_visibility !== undefined) {
    updates.profile_visibility = input.profile_visibility;
  }
  if (input.show_email !== undefined) {
    updates.show_email = boolToInt(input.show_email);
  }
  if (input.show_phone !== undefined) {
    updates.show_phone = boolToInt(input.show_phone);
  }
  if (input.search_indexable !== undefined) {
    updates.search_indexable = boolToInt(input.search_indexable);
  }
  // Messagerie
  if (input.allow_messages_from !== undefined) {
    updates.allow_messages_from = input.allow_messages_from;
  }
  // 🆕 Messagerie avancée
  if (input.read_receipts !== undefined) {
    updates.read_receipts = boolToInt(input.read_receipts);
  }
  if (input.online_status_visibility !== undefined) {
    updates.online_status_visibility = input.online_status_visibility;
  }
  if (input.typing_indicator !== undefined) {
    updates.typing_indicator = boolToInt(input.typing_indicator);
  }
  if (input.call_permissions !== undefined) {
    updates.call_permissions = input.call_permissions;
  }
  // 🆕 Notifications messagerie
  if (input.notification_sound !== undefined) {
    updates.notification_sound = boolToInt(input.notification_sound);
  }
  if (input.call_ringtone !== undefined) {
    updates.call_ringtone = input.call_ringtone;
  }

  const [updated] = await db
    .update(userSettings)
    .set(updates)
    .where(eq(userSettings.user_id, userId))
    .returning();

  // Sync is_private si visibility a changé
  if (input.profile_visibility !== undefined) {
    await syncIsPrivate(userId, input.profile_visibility);
  }

  console.log(`🔒 Confidentialité mise à jour pour user #${userId}`);

  return formatPrivacy(updated);
}

export async function updateProfileVisibility(
  userId: number,
  input: ProfileVisibilityInput
) {
  await getOrCreateSettings(userId);

  const [updated] = await db
    .update(userSettings)
    .set({
      profile_visibility: input.profile_visibility,
      updated_at: new Date(),
    })
    .where(eq(userSettings.user_id, userId))
    .returning();

  await syncIsPrivate(userId, input.profile_visibility);

  console.log(
    `👁️  Visibilité profil mise à jour pour user #${userId} → ${input.profile_visibility}`
  );

  return formatPrivacy(updated);
}

export async function updateMessagesFrom(
  userId: number,
  input: MessagesFromInput
) {
  await getOrCreateSettings(userId);

  const [updated] = await db
    .update(userSettings)
    .set({
      allow_messages_from: input.allow_messages_from,
      updated_at: new Date(),
    })
    .where(eq(userSettings.user_id, userId))
    .returning();

  console.log(
    `💬 Paramètre messages mis à jour pour user #${userId} → ${input.allow_messages_from}`
  );

  return formatPrivacy(updated);
}

// ============================================================
// EXPORT : utile pour d'autres services
// ============================================================

/**
 * Vérifie si un user peut envoyer un message à un autre.
 * Utilisé dans le service de messagerie.
 */
export async function canSendMessageTo(
  senderId: number,
  receiverId: number
): Promise<boolean> {
  if (senderId === receiverId) return true;

  const settings = await getOrCreateSettings(receiverId);

  if (settings.allow_messages_from === "nobody") return false;
  if (settings.allow_messages_from === "everyone") return true;

  if (settings.allow_messages_from === "friends") {
    const { getRelationStatus } = await import(
      "../../friends/friends.service"
    );
    const rel = await getRelationStatus(senderId, receiverId);
    return rel.status === "friends";
  }

  return true;
}

/**
 * Vérifie si un user peut voir le profil d'un autre.
 */
export async function canViewProfile(
  viewerId: number | undefined,
  targetUserId: number
): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  const settings = await getOrCreateSettings(targetUserId);

  if (settings.profile_visibility === "public") return true;
  if (!viewerId) return false;
  if (settings.profile_visibility === "private") return false;

  if (settings.profile_visibility === "friends") {
    const { getRelationStatus } = await import(
      "../../friends/friends.service"
    );
    const rel = await getRelationStatus(viewerId, targetUserId);
    return rel.status === "friends";
  }

  return true;
}

/**
 * 🆕 Vérifie si un user peut appeler un autre.
 * Utilisé dans socket.handlers.ts > call:initiate
 */
export async function canCallUser(
  callerId: number,
  receiverId: number
): Promise<boolean> {
  if (callerId === receiverId) return true;

  const settings = await getOrCreateSettings(receiverId);

  if (settings.call_permissions === "nobody") return false;
  if (settings.call_permissions === "everyone") return true;

  if (settings.call_permissions === "friends") {
    const { getRelationStatus } = await import(
      "../../friends/friends.service"
    );
    const rel = await getRelationStatus(callerId, receiverId);
    return rel.status === "friends";
  }

  return true;
}

/**
 * 🆕 Vérifie si un user a activé les accusés de lecture.
 * Utilisé dans socket.handlers.ts > message:read
 */
export async function hasReadReceiptsEnabled(
  userId: number
): Promise<boolean> {
  const settings = await getOrCreateSettings(userId);
  return settings.read_receipts === 1;
}

/**
 * 🆕 Vérifie si un user a activé l'indicateur de frappe.
 * Utilisé dans socket.handlers.ts > typing:start/stop
 */
export async function hasTypingIndicatorEnabled(
  userId: number
): Promise<boolean> {
  const settings = await getOrCreateSettings(userId);
  return settings.typing_indicator === 1;
}

/**
 * 🆕 Retourne la visibilité du statut online d'un user.
 * Utilisé dans ChatWindow.tsx pour afficher/masquer "En ligne"
 */
export async function getOnlineStatusVisibility(
  userId: number
): Promise<"everyone" | "friends" | "nobody"> {
  const settings = await getOrCreateSettings(userId);
  return (settings.online_status_visibility || "everyone") as
    | "everyone"
    | "friends"
    | "nobody";
}
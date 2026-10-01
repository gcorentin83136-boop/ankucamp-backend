import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import { pushSubscriptions } from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import { sendPushToToken, sendPushToTokens } from "../../../../config/firebase";
import type {
  SubscribePushInput,
  UnsubscribePushInput,
} from "./push.validation";

// ============================================================
// SUBSCRIBE
// ============================================================

/**
 * Enregistre un token FCM pour un user.
 * Si le token existe déjà (peu importe le user), on le met à jour.
 */
export async function subscribePush(
  userId: number,
  input: SubscribePushInput
) {
  const { token, platform, device_info } = input;

  // Vérifie si le token existe déjà
  const [existing] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.token, token))
    .limit(1);

  if (existing) {
    // Le token existe : on met à jour (au cas où il aurait changé d'user)
    const [updated] = await db
      .update(pushSubscriptions)
      .set({
        user_id: userId,
        platform,
        device_info: device_info ?? null,
        last_used_at: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing.id))
      .returning();

    console.log(
      `🔔 Token FCM mis à jour pour user #${userId} (${platform})`
    );

    return updated;
  }

  // Sinon, on crée
  const [created] = await db
    .insert(pushSubscriptions)
    .values({
      user_id: userId,
      token,
      platform,
      device_info: device_info ?? null,
    })
    .returning();

  console.log(
    `🔔 Token FCM enregistré pour user #${userId} (${platform})`
  );

  return created;
}

// ============================================================
// UNSUBSCRIBE
// ============================================================

/**
 * Supprime un token FCM (déconnexion, désinstallation).
 */
export async function unsubscribePush(
  userId: number,
  input: UnsubscribePushInput
) {
  const { token } = input;

  const deleted = await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.token, token),
        eq(pushSubscriptions.user_id, userId)
      )
    )
    .returning({ id: pushSubscriptions.id });

  if (deleted.length === 0) {
    throw new AppError("Token introuvable pour cet utilisateur", 404);
  }

  console.log(`🔕 Token FCM supprimé pour user #${userId}`);

  return { success: true };
}

// ============================================================
// LIST (mes appareils)
// ============================================================

/**
 * Renvoie la liste des devices d'un user.
 */
export async function getMySubscriptions(userId: number) {
  return db
    .select({
      id: pushSubscriptions.id,
      platform: pushSubscriptions.platform,
      device_info: pushSubscriptions.device_info,
      created_at: pushSubscriptions.created_at,
      last_used_at: pushSubscriptions.last_used_at,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.user_id, userId))
    .orderBy(desc(pushSubscriptions.last_used_at));
}

// ============================================================
// SEND (envoi push à tous les devices d'un user)
// ============================================================

/**
 * Envoie un push à TOUS les devices d'un user.
 * Supprime automatiquement les tokens invalides.
 */
export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  // 1. Récupère tous les tokens du user
  const subs = await db
    .select({ token: pushSubscriptions.token })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.user_id, userId));

  if (subs.length === 0) {
    console.log(`🔔 Aucun token FCM pour user #${userId}, skip`);
    return;
  }

  const tokens = subs.map((s) => s.token);

  // 2. Envoie à tous
  const invalidTokens = await sendPushToTokens(tokens, title, body, data);

  // 3. Nettoie les tokens invalides
  if (invalidTokens.length > 0) {
    for (const token of invalidTokens) {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.token, token));
    }

    console.log(
      `🧹 ${invalidTokens.length} token(s) FCM invalide(s) supprimé(s)`
    );
  }

  console.log(
    `🔔 Push envoyé à user #${userId} (${tokens.length - invalidTokens.length}/${tokens.length} devices)`
  );
}

// ============================================================
// SEND ONE (pour test manuel)
// ============================================================

/**
 * Envoie un push à UN seul token (pour tester depuis un endpoint).
 */
export async function sendPushToTokenDirect(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  return sendPushToToken({ token, title, body, data });
}
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userSettings } from "../db/schema";
import { createNotification } from "../api/notifications/notifications.service";
import { sendPushToUser } from "../api/notifications/push/push.service";

// ============================================================
// TYPES
// ============================================================

export type NotificationType =
  | "order"      // Nouvelle commande / Changement de statut
  | "review"     // Nouvel avis reçu / Avis signalé
  | "message"    // Nouveau message privé
  | "social"     // Follow, like, commentaire (réseau social)
  | "system"     // Annonces système, maintenance
  | "welcome";   // Bienvenue après inscription

// ============================================================
// HELPERS PRIVÉS
// ============================================================

/**
 * Vérifie si un user veut recevoir un PUSH pour ce type de notif.
 *
 * Mapping :
 * - "order" / "review"  → push_order_updates
 * - "message"           → push_new_messages
 * - "social"            → push_social_activity
 * - "system" / "welcome" → toujours true (critique)
 */
async function shouldPush(
  userId: number,
  type: NotificationType
): Promise<boolean> {
  // Les notifs système et de bienvenue sont toujours poussées
  if (type === "system" || type === "welcome") return true;

  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .limit(1);

    // Si pas de settings → défaut (tout activé)
    if (!settings) return true;

    switch (type) {
      case "order":
      case "review":
        return settings.push_order_updates === 1;
      case "message":
        return settings.push_new_messages === 1;
      case "social":
        return settings.push_social_activity === 1;
      default:
        return true;
    }
  } catch (err) {
    console.error(
      `❌ Erreur lecture préférences push (user #${userId}):`,
      err
    );
    // En cas d'erreur, on est permissif (default activé)
    return true;
  }
}

/**
 * Prépare les data à envoyer dans le payload FCM.
 */
function buildPushData(
  type: NotificationType,
  link?: string,
  data?: Record<string, unknown>
): Record<string, string> {
  const pushData: Record<string, string> = { type };

  if (link) pushData.link = link;

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      pushData[key] = String(value);
    }
  }

  return pushData;
}

// ============================================================
// HELPER PRINCIPAL
// ============================================================

/**
 * Crée une notification pour un utilisateur (fire & forget).
 *
 * ✅ Crée la notif DB
 * ✅ Envoie un push FCM UNIQUEMENT si le user n'a pas désactivé cette catégorie
 *
 * Utilisation :
 *   await notify(sellerId, "order", "Nouvelle commande", "Corentin a commandé chez toi", "/orders/12");
 *
 * ⚠️ Ne bloque PAS en cas d'erreur (fire & forget silencieux).
 */
export async function notify(
  userId: number,
  type: NotificationType,
  title: string,
  content: string,
  link?: string,
  data?: Record<string, unknown>
): Promise<void> {
  // 1. Créer la notif DB (fire & forget)
  try {
    await createNotification({
      userId,
      type,
      title,
      content,
      link: link ?? null,
      data: data ?? null,
    });

    console.log(
      `🔔 Notification "${type}" créée pour user #${userId} : ${title}`
    );
  } catch (err) {
    console.error(
      `❌ Erreur création notification (user #${userId}, type "${type}"):`,
      err
    );
    // On continue quand même : on essaie d'envoyer le push
  }

  // 2. Vérifier les préférences user AVANT d'envoyer le push
  const pushAllowed = await shouldPush(userId, type);

  if (!pushAllowed) {
    console.log(
      `🔕 Push désactivé par user #${userId} pour type "${type}"`
    );
    return;
  }

  // 3. Envoyer le push FCM à tous les devices (fire & forget)
  try {
    const pushData = buildPushData(type, link, data);
    await sendPushToUser(userId, title, content, pushData);
  } catch (err) {
    console.error(
      `❌ Erreur envoi push (user #${userId}, type "${type}"):`,
      err
    );
  }
}

// ============================================================
// HELPERS SPÉCIALISÉS
// ============================================================

/**
 * Notifie le vendeur qu'il a reçu une nouvelle commande.
 */
export async function notifyNewOrder(
  sellerId: number,
  orderId: number,
  buyerName: string,
  totalPrice: string
): Promise<void> {
  await notify(
    sellerId,
    "order",
    `Nouvelle commande #${orderId} 🛒`,
    `${buyerName} vient de commander chez toi pour ${totalPrice} €.`,
    `/dashboard/orders/${orderId}`
  );
}

/**
 * Notifie l'acheteur que sa commande a été expédiée.
 */
export async function notifyOrderShipped(
  buyerId: number,
  orderId: number,
  trackingNumber?: string | null
): Promise<void> {
  const content = trackingNumber
    ? `Ta commande #${orderId} est en route ! Suivi : ${trackingNumber}`
    : `Ta commande #${orderId} est en route !`;

  await notify(
    buyerId,
    "order",
    `Commande #${orderId} expédiée 📦`,
    content,
    `/orders/${orderId}`
  );
}

/**
 * Notifie l'acheteur que sa commande a été livrée.
 */
export async function notifyOrderDelivered(
  buyerId: number,
  orderId: number
): Promise<void> {
  await notify(
    buyerId,
    "order",
    `Commande #${orderId} livrée 🎉`,
    `Ta commande est arrivée. Laisse un avis pour aider la communauté !`,
    `/orders/${orderId}/review`
  );
}

/**
 * Notifie le vendeur que sa commande a été annulée.
 */
export async function notifyOrderCancelled(
  sellerId: number,
  orderId: number
): Promise<void> {
  await notify(
    sellerId,
    "order",
    `Commande #${orderId} annulée ❌`,
    `L'acheteur a annulé cette commande.`,
    `/dashboard/orders/${orderId}`
  );
}

/**
 * Notifie le vendeur qu'il a reçu un nouvel avis.
 */
export async function notifyNewReview(
  sellerId: number,
  reviewId: number,
  rating: number,
  productName: string,
  authorName: string
): Promise<void> {
  const stars = "⭐".repeat(rating);

  await notify(
    sellerId,
    "review",
    `Nouvel avis ${stars}`,
    `${authorName} a laissé un avis sur "${productName}".`,
    `/dashboard/reviews/${reviewId}`
  );
}
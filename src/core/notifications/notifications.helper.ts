import { createNotification } from "../api/notifications/notifications.service";

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
// HELPER PRINCIPAL
// ============================================================

/**
 * Crée une notification pour un utilisateur (fire & forget).
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
    // Fire & forget : on log mais on ne propage pas
    console.error(
      `❌ Erreur création notification (user #${userId}, type "${type}"):`,
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
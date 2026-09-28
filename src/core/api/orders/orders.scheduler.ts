import { eq, and, lt, isNull, isNotNull } from "drizzle-orm";
import { db } from "../../db";
import { orders, reviews } from "../../db/schema";
import { sendReviewRequestEmail } from "./orders.emails";

// ============================================================
// CONFIG
// ============================================================

const REVIEW_DELAY_DAYS = 3; // Envoie la relance 3 jours après livraison
const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // Toutes les 6 heures

// ============================================================
// LOGIQUE PRINCIPALE
// ============================================================

/**
 * Cherche les commandes livrées depuis > 3 jours,
 * dont l'utilisateur n'a pas encore été relancé,
 * et envoie un email de relance.
 */
export async function processReviewRequests(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(
    now.getTime() - REVIEW_DELAY_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    // 1. Trouve les commandes candidates
    const candidates = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, "delivered"),
          isNotNull(orders.delivered_at),
          lt(orders.delivered_at, cutoff),
          isNull(orders.review_requested_at)
        )
      )
      .limit(50);

    if (candidates.length === 0) {
      console.log(`⏰ [Scheduler] Aucune relance à envoyer.`);
      return;
    }

    console.log(
      `⏰ [Scheduler] ${candidates.length} commande(s) à relancer...`
    );

    let sent = 0;
    let skipped = 0;

    for (const order of candidates) {
      // 2. Vérifie que le buyer n'a pas déjà laissé un avis
      const existingReviews = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.order_id, order.id))
        .limit(1);

      if (existingReviews.length > 0) {
        // Déjà noté → on marque comme relancé pour ne plus revenir
        await db
          .update(orders)
          .set({ review_requested_at: now })
          .where(eq(orders.id, order.id));
        skipped++;
        continue;
      }

      // 3. Envoie l'email
      const daysSince = Math.floor(
        (now.getTime() - order.delivered_at!.getTime()) /
          (24 * 60 * 60 * 1000)
      );

      try {
        await sendReviewRequestEmail(order.id, daysSince);

        // 4. Marque comme relancé
        await db
          .update(orders)
          .set({ review_requested_at: now })
          .where(eq(orders.id, order.id));

        sent++;
      } catch (err) {
        console.error(
          `❌ Erreur envoi relance avis commande #${order.id}:`,
          err
        );
      }
    }

    console.log(
      `⏰ [Scheduler] Terminé : ${sent} envoyé(s), ${skipped} ignoré(s).`
    );
  } catch (err) {
    console.error("❌ [Scheduler] Erreur globale:", err);
  }
}

// ============================================================
// DÉMARRAGE / ARRÊT
// ============================================================

let intervalHandle: NodeJS.Timeout | null = null;

/**
 * Démarre le scheduler.
 * Premier run 1 minute après le démarrage du serveur,
 * puis toutes les 6 heures.
 */
export function startReviewScheduler(): void {
  if (intervalHandle) {
    console.log("⏰ [Scheduler] Déjà démarré.");
    return;
  }

  console.log(
    `⏰ [Scheduler] Démarrage (interval: ${
      RUN_INTERVAL_MS / (60 * 60 * 1000)
    }h, délai relance: ${REVIEW_DELAY_DAYS}j)`
  );

  // Premier run après 1 minute
  setTimeout(() => {
    processReviewRequests();
  }, 60 * 1000);

  // Puis toutes les 6h
  intervalHandle = setInterval(processReviewRequests, RUN_INTERVAL_MS);
}

/**
 * Arrête le scheduler (utile pour les tests).
 */
export function stopReviewScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("⏰ [Scheduler] Arrêté.");
  }
}
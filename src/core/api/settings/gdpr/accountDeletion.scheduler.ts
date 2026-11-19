import { eq, and, lt, sql } from "drizzle-orm";
import { db } from "../../../db";
import {
  users,
  accountDeletionRequests,
  userSessions,
  posts,
  postLikes,
  postComments,
  friendships,
  follows,
  notifications,
} from "../../../db/schema";

// ============================================================
// CONFIG
// ============================================================

const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // Toutes les 6h

// ============================================================
// LOGIQUE
// ============================================================

/**
 * Cherche les demandes de suppression dont la date est dépassée
 * et anonymise les comptes correspondants.
 */
export async function processAccountDeletions(): Promise<void> {
  const now = new Date();

  try {
    // 1. Trouve les demandes à traiter
    const candidates = await db
      .select()
      .from(accountDeletionRequests)
      .where(
        and(
          eq(accountDeletionRequests.status, "pending"),
          lt(accountDeletionRequests.scheduled_deletion_at, now)
        )
      )
      .limit(50);

    if (candidates.length === 0) {
      console.log(`🗑️  [Scheduler RGPD] Aucune suppression à traiter.`);
      return;
    }

    console.log(
      `🗑️  [Scheduler RGPD] ${candidates.length} compte(s) à supprimer...`
    );

    let anonymized = 0;

    for (const request of candidates) {
      const userId = request.user_id;

      try {
        console.log(`⚙️  Anonymisation du compte #${userId}...`);

        // Récupère le user pour l'email anonymisé
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          console.error(`❌ User #${userId} introuvable, skip.`);
          continue;
        }

        // ============================================================
        // 1. Anonymisation du profil user
        // ============================================================
        await db
          .update(users)
          .set({
            first_name: "Compte",
            last_name: "Supprimé",
            username: `deleted_${userId}_${Date.now()}`,
            email: `deleted-${userId}-${Date.now()}@anku.local`,
            password_hash: null,
            avatar_url: null,
            cover_url: null,
            bio: null,
            website: null,
            location: null,
            address: null,
            city: null,
            postal_code: null,
            activation_token: null,
            activation_token_expires: null,
            reset_password_token: null,
            reset_password_token_expires: null,
            email_verified: 0,
          })
          .where(eq(users.id, userId));

        // ============================================================
        // 2. Suppression des données sociales
        // ============================================================
        await db.delete(posts).where(eq(posts.author_id, userId));
        await db.delete(postLikes).where(eq(postLikes.user_id, userId));
        await db.delete(postComments).where(eq(postComments.author_id, userId));
        await db
          .delete(friendships)
          .where(eq(friendships.requester_id, userId));
        await db
          .delete(friendships)
          .where(eq(friendships.receiver_id, userId));
        await db.delete(follows).where(eq(follows.follower_id, userId));
        await db
          .delete(notifications)
          .where(eq(notifications.user_id, userId));

        // ============================================================
        // 3. Révoquer toutes les sessions
        // ============================================================
        await db.delete(userSessions).where(eq(userSessions.user_id, userId));

        // ============================================================
        // 4. Marque la demande comme complétée
        // ============================================================
        await db
          .update(accountDeletionRequests)
          .set({ status: "completed" })
          .where(eq(accountDeletionRequests.id, request.id));

        console.log(`✅ Compte #${userId} anonymisé.`);
        anonymized++;
      } catch (err) {
        console.error(
          `❌ Erreur anonymisation compte #${userId}:`,
          err
        );
      }
    }

    console.log(
      `🗑️  [Scheduler RGPD] Terminé : ${anonymized} compte(s) anonymisé(s).`
    );
  } catch (err) {
    console.error("❌ [Scheduler RGPD] Erreur globale:", err);
  }
}

// ============================================================
// DÉMARRAGE / ARRÊT
// ============================================================

let intervalHandle: NodeJS.Timeout | null = null;

export function startAccountDeletionScheduler(): void {
  if (intervalHandle) {
    console.log("🗑️  [Scheduler RGPD] Déjà démarré.");
    return;
  }

  console.log(
    `🗑️  [Scheduler RGPD] Démarrage (interval: ${
      RUN_INTERVAL_MS / (60 * 60 * 1000)
    }h)`
  );

  // Premier run après 2 minutes
  setTimeout(() => {
    processAccountDeletions();
  }, 2 * 60 * 1000);

  // Puis toutes les 6h
  intervalHandle = setInterval(processAccountDeletions, RUN_INTERVAL_MS);
}

export function stopAccountDeletionScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("🗑️  [Scheduler RGPD] Arrêté.");
  }
}
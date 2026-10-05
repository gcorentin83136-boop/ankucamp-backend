import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { users, posts, friendships, reviews } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type {
  UpdateProfileInput,
  ListUsersQuery,
} from "./users.validation";

// ============================================================
// COLONNES PUBLIQUES (jamais de password_hash)
// ============================================================

const publicColumns = {
  id: users.id,
  first_name: users.first_name,
  last_name: users.last_name,
  username: users.username,
  email: users.email,
  birth_year: users.birth_year,
  address: users.address,
  city: users.city,
  postal_code: users.postal_code,
  country: users.country,
  avatar_url: users.avatar_url,
  cover_url: users.cover_url,
  bio: users.bio,
  website: users.website,
  location: users.location,
  is_private: users.is_private,
  provider: users.provider,
  role: users.role,
  email_verified: users.email_verified,
  verification_status: users.verification_status,
  suspended_until: users.suspended_until,
  suspension_reason: users.suspension_reason,
  created_at: users.created_at,
};

// ============================================================
// LECTURE
// ============================================================

export async function getUserById(id: number) {
  const [user] = await db
    .select(publicColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

export async function getUserByUsername(username: string) {
  const [user] = await db
    .select(publicColumns)
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user ?? null;
}

/**
 * Liste paginÃ©e des users.
 */
export async function getAllUsers(limit = 50, offset = 0) {
  return db
    .select(publicColumns)
    .from(users)
    .orderBy(desc(users.created_at))
    .limit(limit)
    .offset(offset);
}

/**
 * Recherche des utilisateurs par nom/prÃ©nom/username.
 */
export async function searchUsers(query: ListUsersQuery) {
  const { limit, offset, search } = query;

  if (!search || search.trim() === "") {
    return db
      .select(publicColumns)
      .from(users)
      .orderBy(desc(users.created_at))
      .limit(limit)
      .offset(offset);
  }

  const pattern = `%${search}%`;

  return db
    .select(publicColumns)
    .from(users)
    .where(
      or(
        ilike(users.first_name, pattern),
        ilike(users.last_name, pattern),
        ilike(users.username, pattern)
      )
    )
    .orderBy(desc(users.created_at))
    .limit(limit)
    .offset(offset);
}

// ============================================================
// MISE Ã€ JOUR
// ============================================================

export async function updateUser(id: number, data: UpdateProfileInput) {
  // Nettoyage : on enlÃ¨ve les undefined et on gÃ¨re le website vide
  const cleanData: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === "website" && value === "") {
      cleanData[key] = null;
    } else {
      cleanData[key] = value;
    }
  }

  const hasData = Object.keys(cleanData).length > 0;
  if (!hasData) {
    throw new AppError("Aucune donnÃ©e Ã  mettre Ã  jour", 400);
  }

  // VÃ©rif unicitÃ© email si changÃ©
  if (cleanData.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanData.email))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      throw new AppError("Cet email est dÃ©jÃ  utilisÃ©", 400);
    }
  }

  // VÃ©rif unicitÃ© username si changÃ©
  if (cleanData.username) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, cleanData.username))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      throw new AppError("Ce username est dÃ©jÃ  utilisÃ©", 400);
    }
  }

  const [updated] = await db
    .update(users)
    .set(cleanData)
    .where(eq(users.id, id))
    .returning(publicColumns);

  return updated ?? null;
}

/**
 * Toggle is_private.
 */
export async function updatePrivacy(id: number, isPrivate: boolean) {
  const [updated] = await db
    .update(users)
    .set({ is_private: isPrivate ? 1 : 0 })
    .where(eq(users.id, id))
    .returning(publicColumns);

  if (!updated) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  return updated;
}

// ============================================================
// STATS PROFIL
// ============================================================

/**
 * Stats publiques d'un profil : nb de posts, amis, avis reÃ§us, note moyenne.
 */
export async function getUserStats(userId: number) {
  // Nombre de posts
  const [postsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.author_id, userId));

  // Nombre d'amis acceptÃ©s
  const [friendsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        or(
          eq(friendships.requester_id, userId),
          eq(friendships.receiver_id, userId)
        ),
        eq(friendships.status, "accepted")
      )
    );

  // Nombre d'avis reÃ§us (en tant que vendeur)
  const [reviewsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.seller_id, userId));

  // Note moyenne (en tant que vendeur)
  const [avgRating] = await db
    .select({
      avg: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
    })
    .from(reviews)
    .where(and(eq(reviews.seller_id, userId), eq(reviews.is_flagged, 0)));

  return {
    posts_count: postsCount?.count ?? 0,
    friends_count: friendsCount?.count ?? 0,
    reviews_count: reviewsCount?.count ?? 0,
    average_rating: Number((avgRating?.avg ?? 0).toFixed?.(1) ?? avgRating?.avg ?? 0),
  };
}

// ============================================================
// ADMIN — SUSPENSION / SUPPRESSION
// ============================================================

import { userSessions } from "../../db/schema";

/**
 * Suspend un compte pour N jours (bloque le login uniquement).
 */
export async function suspendUser(
  userId: number,
  days: number,
  reason: string
) {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError("Durée de suspension invalide (1-365 jours)", 400);
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);
  if (user.role === "admin") {
    throw new AppError("Impossible de suspendre un admin", 403);
  }

  const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({
      suspended_until: suspendedUntil,
      suspension_reason: reason || null,
    })
    .where(eq(users.id, userId));

  // Révocation immédiate des sessions (l'user est déco tout de suite)
  await db.delete(userSessions).where(eq(userSessions.user_id, userId));

  console.log(
    `🚫 User #${userId} suspendu jusqu'au ${suspendedUntil.toISOString()} (${days}j)`
  );

  return {
    success: true,
    suspended_until: suspendedUntil,
    reason: reason || null,
  };
}

/**
 * Lève la suspension d'un compte.
 */
export async function unsuspendUser(userId: number) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);

  await db
    .update(users)
    .set({ suspended_until: null, suspension_reason: null })
    .where(eq(users.id, userId));

  console.log(`✅ User #${userId} désuspendu`);

  return { success: true };
}

/**
 * Anonymise un compte (suppression définitive cohérente avec le scheduler RGPD).
 * Les données liées (posts, orders, avis) restent en place mais rattachées à un compte anonyme.
 */
export async function anonymizeUser(userId: number) {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable", 404);
  if (user.role === "admin") {
    throw new AppError("Impossible de supprimer un admin", 403);
  }

  const ts = Date.now();

  await db
    .update(users)
    .set({
      first_name: "Compte",
      last_name: "Supprimé",
      username: `deleted_${userId}_${ts}`,
      email: `deleted-${userId}-${ts}@anku.local`,
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
      suspended_until: null,
      suspension_reason: null,
    })
    .where(eq(users.id, userId));

  // Révocation de toutes les sessions
  await db.delete(userSessions).where(eq(userSessions.user_id, userId));

  console.log(`🗑️ User #${userId} anonymisé`);

  return { success: true };
}
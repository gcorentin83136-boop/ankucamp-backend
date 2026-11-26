import { eq, and, or, ilike, desc, sql, notInArray } from "drizzle-orm";
import { db } from "../../db";
import { users, posts, friendships, reviews, userSessions } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getHiddenUserIds } from "./blocks.service";
import {
  notifyUserSuspended,
  notifyUserUnsuspended,
} from "../../notifications/notifications.helper";
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
  latitude: users.latitude,
  longitude: users.longitude,
  is_private: users.is_private,
  profile_completed: users.profile_completed,
  provider: users.provider,
  role: users.role,
  email_verified: users.email_verified,
  verification_status: users.verification_status,
  stripe_account_status: users.stripe_account_status,
  suspended_until: users.suspended_until,
  suspension_reason: users.suspension_reason,
  created_at: users.created_at,
};

// ============================================================
// LECTURE
// ============================================================

export async function getUserById(id: number, viewerId?: number) {
  const [user] = await db
    .select(publicColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return null;

  if (viewerId && viewerId !== id) {
    const hidden = await getHiddenUserIds(viewerId);
    if (hidden.includes(id)) {
      throw new AppError("Cet utilisateur n'est pas disponible", 403);
    }
  }

  return user;
}

export async function getUserByUsername(username: string, viewerId?: number) {
  const [user] = await db
    .select(publicColumns)
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) return null;

  if (viewerId && viewerId !== user.id) {
    const hidden = await getHiddenUserIds(viewerId);
    if (hidden.includes(user.id)) {
      throw new AppError("Cet utilisateur n'est pas disponible", 403);
    }
  }

  return user;
}

export async function getAllUsers(limit = 50, offset = 0) {
  return db
    .select(publicColumns)
    .from(users)
    .orderBy(desc(users.created_at))
    .limit(limit)
    .offset(offset);
}

/**
 * Recherche des utilisateurs par nom/prénom/username.
 * 🆕 Exclut les utilisateurs bloqués si un viewerId est fourni.
 */
export async function searchUsers(query: ListUsersQuery, viewerId?: number) {
  const { limit, offset, search } = query;

  let hiddenIds: number[] = [];
  if (viewerId) {
    hiddenIds = await getHiddenUserIds(viewerId);
  }

  let searchCondition = undefined;
  if (search && search.trim() !== "") {
    const pattern = `%${search}%`;
    searchCondition = or(
      ilike(users.first_name, pattern),
      ilike(users.last_name, pattern),
      ilike(users.username, pattern)
    );
  }

  let whereCondition = searchCondition;
  if (hiddenIds.length > 0) {
    if (whereCondition) {
      whereCondition = and(whereCondition, notInArray(users.id, hiddenIds));
    } else {
      whereCondition = notInArray(users.id, hiddenIds);
    }
  }

  return db
    .select(publicColumns)
    .from(users)
    .where(whereCondition) // Si undefined, renvoie tout (cas où search est vide et pas de hiddenIds)
    .orderBy(desc(users.created_at))
    .limit(limit)
    .offset(offset);
}

// ============================================================
// MISE À JOUR
// ============================================================

export async function updateUser(id: number, data: UpdateProfileInput) {
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
    throw new AppError("Aucune donnée à mettre à jour", 400);
  }

  const [currentUser] = await db
    .select({
      avatar_url: users.avatar_url,
      bio: users.bio,
      profile_completed: users.profile_completed,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (currentUser && !currentUser.profile_completed) {
    const futureAvatar =
      cleanData.avatar_url !== undefined
        ? cleanData.avatar_url
        : currentUser.avatar_url;
    const futureBio =
      cleanData.bio !== undefined ? cleanData.bio : currentUser.bio;
    const hasAvatar = !!futureAvatar && String(futureAvatar).trim().length > 0;
    const hasBio = !!futureBio && String(futureBio).trim().length > 0;
    if (hasAvatar || hasBio) {
      cleanData.profile_completed = 1;
    }
  }

  if (cleanData.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanData.email))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      throw new AppError("Cet email est déjà utilisé", 400);
    }
  }

  if (cleanData.username) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, cleanData.username))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      throw new AppError("Ce username est déjà utilisé", 400);
    }
  }

  const [updated] = await db
    .update(users)
    .set(cleanData)
    .where(eq(users.id, id))
    .returning(publicColumns);

  return updated ?? null;
}

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

export async function getUserStats(userId: number) {
  const [postsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.author_id, userId));

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

  const [reviewsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.seller_id, userId));

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

  await db.delete(userSessions).where(eq(userSessions.user_id, userId));

  console.log(
    `🚫 User #${userId} suspendu jusqu'au ${suspendedUntil.toISOString()} (${days}j)`
  );

  notifyUserSuspended(userId, days, reason || "").catch((err) =>
    console.error("❌ Erreur notif suspendu:", err)
  );

  return {
    success: true,
    suspended_until: suspendedUntil,
    reason: reason || null,
  };
}

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

  notifyUserUnsuspended(userId).catch((err) =>
    console.error("❌ Erreur notif désuspendu:", err)
  );

  return { success: true };
}

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

  await db.delete(userSessions).where(eq(userSessions.user_id, userId));

  console.log(`🗑️ User #${userId} anonymisé`);

  return { success: true };
}

// ============================================================
// SKIP COMPLÉTION DE PROFIL
// ============================================================

export async function skipProfileCompletion(userId: number) {
  const [updated] = await db
    .update(users)
    .set({ profile_completed: 1 })
    .where(eq(users.id, userId))
    .returning({ id: users.id, profile_completed: users.profile_completed });

  if (!updated) throw new AppError("Utilisateur introuvable", 404);
  return updated;
}
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { friendships, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import {
  notifyFriendRequest,
  notifyFriendAccepted,
} from "../../notifications/social-notifications.helper";
import type { ListFriendsQuery } from "./friends.validation";

// ============================================================
// HELPERS PRIVÉS
// ============================================================

/**
 * Récupère la ligne de relation entre 2 users (peu importe le sens).
 */
async function getRelationship(userA: number, userB: number) {
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.requester_id, userA),
          eq(friendships.receiver_id, userB)
        ),
        and(
          eq(friendships.requester_id, userB),
          eq(friendships.receiver_id, userA)
        )
      )
    )
    .limit(1);

  return row ?? null;
}

// ============================================================
// STATUT DE LA RELATION
// ============================================================

/**
 * Renvoie le statut de la relation entre le user connecté et un autre :
 * - "none" : pas de relation
 * - "pending_sent" : demande envoyée en attente
 * - "pending_received" : demande reçue en attente
 * - "friends" : amis acceptés
 * - "blocked" : bloqué
 */
export async function getRelationStatus(
  userId: number,
  targetUserId: number
) {
  if (userId === targetUserId) {
    throw new AppError("Impossible de vérifier la relation avec soi-même", 400);
  }

  const rel = await getRelationship(userId, targetUserId);

  if (!rel) return { status: "none" };

  if (rel.status === "accepted") {
    return { status: "friends" };
  }

  if (rel.status === "pending") {
    if (rel.requester_id === userId) {
      return { status: "pending_sent", request_id: rel.id };
    }
    return { status: "pending_received", request_id: rel.id };
  }

  if (rel.status === "blocked") {
    return { status: "blocked", by_me: rel.requester_id === userId };
  }

  if (rel.status === "declined") {
    return { status: "declined" };
  }

  return { status: "unknown" };
}

// ============================================================
// DEMANDE D'AMI
// ============================================================

export async function sendFriendRequest(
  requesterId: number,
  receiverId: number
) {
  if (requesterId === receiverId) {
    throw new AppError("Tu ne peux pas t'envoyer une demande à toi-même", 400);
  }

  // Vérifier que le receiver existe
  const [receiver] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(users)
    .where(eq(users.id, receiverId))
    .limit(1);

  if (!receiver) {
    throw new AppError("Utilisateur introuvable", 404);
  }

  // Vérifier qu'il n'y a pas déjà une relation
  const existing = await getRelationship(requesterId, receiverId);

  if (existing) {
    if (existing.status === "accepted") {
      throw new AppError("Vous êtes déjà amis", 400);
    }
    if (existing.status === "pending") {
      throw new AppError("Une demande est déjà en attente", 400);
    }
    if (existing.status === "blocked") {
      throw new AppError("Impossible d'envoyer une demande à cet utilisateur", 403);
    }
    if (existing.status === "declined") {
      // On permet de renvoyer après un refus → on supprime et on recrée
      await db.delete(friendships).where(eq(friendships.id, existing.id));
    }
  }

  const [created] = await db
    .insert(friendships)
    .values({
      requester_id: requesterId,
      receiver_id: receiverId,
      status: "pending",
    })
    .returning();

  // Notif
  try {
    const [requester] = await db
      .select({ first_name: users.first_name, last_name: users.last_name })
      .from(users)
      .where(eq(users.id, requesterId))
      .limit(1);

    if (requester) {
      notifyFriendRequest(
        receiverId,
        requesterId,
        `${requester.first_name} ${requester.last_name}`
      ).catch((err) => console.error("❌ Erreur notif friend request:", err));
    }
  } catch (err) {
    console.error("❌ Erreur traitement notif friend request:", err);
  }

  return created;
}

// ============================================================
// ACCEPTER / REFUSER
// ============================================================

export async function acceptFriendRequest(
  requestId: number,
  userId: number
) {
  const [rel] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, requestId))
    .limit(1);

  if (!rel) throw new AppError("Demande introuvable", 404);

  // Seul le receiver peut accepter
  if (rel.receiver_id !== userId) {
    throw new AppError("Tu n'es pas autorisé à accepter cette demande", 403);
  }

  if (rel.status !== "pending") {
    throw new AppError("Cette demande n'est plus en attente", 400);
  }

  const [updated] = await db
    .update(friendships)
    .set({ status: "accepted", responded_at: new Date() })
    .where(eq(friendships.id, requestId))
    .returning();

  // Notif au requester
  try {
    const [accepter] = await db
      .select({ first_name: users.first_name, last_name: users.last_name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (accepter) {
      notifyFriendAccepted(
        rel.requester_id,
        `${accepter.first_name} ${accepter.last_name}`
      ).catch((err) => console.error("❌ Erreur notif friend accepted:", err));
    }
  } catch (err) {
    console.error("❌ Erreur traitement notif friend accepted:", err);
  }

  return updated;
}

export async function declineFriendRequest(
  requestId: number,
  userId: number
) {
  const [rel] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, requestId))
    .limit(1);

  if (!rel) throw new AppError("Demande introuvable", 404);

  if (rel.receiver_id !== userId) {
    throw new AppError("Tu n'es pas autorisé à refuser cette demande", 403);
  }

  if (rel.status !== "pending") {
    throw new AppError("Cette demande n'est plus en attente", 400);
  }

  await db
    .update(friendships)
    .set({ status: "declined", responded_at: new Date() })
    .where(eq(friendships.id, requestId));
}

/**
 * Annuler une demande qu'on a envoyée.
 */
export async function cancelFriendRequest(
  requestId: number,
  userId: number
) {
  const [rel] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, requestId))
    .limit(1);

  if (!rel) throw new AppError("Demande introuvable", 404);

  if (rel.requester_id !== userId) {
    throw new AppError("Tu n'as pas envoyé cette demande", 403);
  }

  if (rel.status !== "pending") {
    throw new AppError("Cette demande n'est plus en attente", 400);
  }

  await db.delete(friendships).where(eq(friendships.id, requestId));
}

// ============================================================
// SUPPRIMER UN AMI
// ============================================================

export async function removeFriend(friendUserId: number, userId: number) {
  const rel = await getRelationship(userId, friendUserId);

  if (!rel) throw new AppError("Aucune relation avec cet utilisateur", 404);

  if (rel.status !== "accepted") {
    throw new AppError("Vous n'êtes pas amis", 400);
  }

  await db.delete(friendships).where(eq(friendships.id, rel.id));
}

// ============================================================
// LISTES
// ============================================================

/**
 * Liste des amis acceptés (avec infos user).
 */
export async function listFriends(userId: number, query: ListFriendsQuery) {
  const { limit, offset } = query;

  // On récupère toutes les relations acceptées où l'user est impliqué
  const rows = await db
    .select({
      friendship_id: friendships.id,
      requester_id: friendships.requester_id,
      receiver_id: friendships.receiver_id,
      created_at: friendships.created_at,
    })
    .from(friendships)
    .where(
      and(
        or(
          eq(friendships.requester_id, userId),
          eq(friendships.receiver_id, userId)
        ),
        eq(friendships.status, "accepted")
      )
    )
    .orderBy(desc(friendships.created_at))
    .limit(limit)
    .offset(offset);

  // Récupère les IDs des amis
  const friendIds = rows.map((r) =>
    r.requester_id === userId ? r.receiver_id : r.requester_id
  );

  if (friendIds.length === 0) return [];

  // Charge les infos des amis
  const friends = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
      is_private: users.is_private,
    })
    .from(users)
    .where(inArray(users.id, friendIds));

  // Fusionne avec la date d'amitié
  return friends.map((f) => {
    const rel = rows.find(
      (r) => r.requester_id === f.id || r.receiver_id === f.id
    );
    return {
      ...f,
      friends_since: rel?.created_at,
      friendship_id: rel?.friendship_id,
    };
  });
}

/**
 * Demandes reçues en attente.
 */
export async function listReceivedRequests(
  userId: number,
  query: ListFriendsQuery
) {
  const { limit, offset } = query;

  const rows = await db
    .select({
      id: friendships.id,
      requester_id: friendships.requester_id,
      created_at: friendships.created_at,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
    })
    .from(friendships)
    .leftJoin(users, eq(users.id, friendships.requester_id))
    .where(
      and(
        eq(friendships.receiver_id, userId),
        eq(friendships.status, "pending")
      )
    )
    .orderBy(desc(friendships.created_at))
    .limit(limit)
    .offset(offset);

  return rows;
}

/**
 * Demandes envoyées en attente.
 */
export async function listSentRequests(
  userId: number,
  query: ListFriendsQuery
) {
  const { limit, offset } = query;

  const rows = await db
    .select({
      id: friendships.id,
      receiver_id: friendships.receiver_id,
      created_at: friendships.created_at,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
    })
    .from(friendships)
    .leftJoin(users, eq(users.id, friendships.receiver_id))
    .where(
      and(
        eq(friendships.requester_id, userId),
        eq(friendships.status, "pending")
      )
    )
    .orderBy(desc(friendships.created_at))
    .limit(limit)
    .offset(offset);

  return rows;
}

// ============================================================
// STATS
// ============================================================

/**
 * Renvoie le nombre d'amis + demandes reçues en attente.
 */
export async function getFriendStats(userId: number) {
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

  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.receiver_id, userId),
        eq(friendships.status, "pending")
      )
    );

  return {
    friends_count: friendsCount?.count ?? 0,
    pending_requests_count: pendingCount?.count ?? 0,
  };
}
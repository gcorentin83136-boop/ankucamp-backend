import { notify } from "./notifications.helper";

// ============================================================
// NOTIFICATIONS RÉSEAU SOCIAL
// ============================================================

/**
 * Notifie un user qu'il a reçu un like sur son post.
 */
export async function notifyPostLiked(
  postAuthorId: number,
  postId: number,
  likerName: string
): Promise<void> {
  await notify(
    postAuthorId,
    "social",
    `❤️ ${likerName} a aimé ton post`,
    `Ton post a reçu un nouveau like.`,
    `/posts/${postId}`
  );
}

/**
 * Notifie un user qu'il a reçu un commentaire sur son post.
 */
export async function notifyPostCommented(
  postAuthorId: number,
  postId: number,
  commenterName: string
): Promise<void> {
  await notify(
    postAuthorId,
    "social",
    `💬 ${commenterName} a commenté ton post`,
    `Clique pour voir le commentaire.`,
    `/posts/${postId}`
  );
}

/**
 * Notifie un user que son commentaire a reçu une réponse.
 */
export async function notifyCommentReplied(
  commentAuthorId: number,
  postId: number,
  replierName: string
): Promise<void> {
  await notify(
    commentAuthorId,
    "social",
    `↩️ ${replierName} a répondu à ton commentaire`,
    `Clique pour voir la réponse.`,
    `/posts/${postId}`
  );
}

/**
 * Notifie un user qu'il a été mentionné dans un post ou commentaire.
 */
export async function notifyMentioned(
  userId: number,
  postId: number,
  mentionerName: string
): Promise<void> {
  await notify(
    userId,
    "social",
    `📣 ${mentionerName} t'a mentionné`,
    `Clique pour voir la mention.`,
    `/posts/${postId}`
  );
}

/**
 * Notifie un user qu'il a une nouvelle demande d'ami.
 */
export async function notifyFriendRequest(
  receiverId: number,
  requesterId: number,
  requesterName: string
): Promise<void> {
  await notify(
    receiverId,
    "social",
    `👥 Nouvelle demande d'ami`,
    `${requesterName} souhaite devenir ton ami.`,
    `/friends/requests`
  );
}

/**
 * Notifie un user que sa demande d'ami a été acceptée.
 */
export async function notifyFriendAccepted(
  requesterId: number,
  accepterName: string
): Promise<void> {
  await notify(
    requesterId,
    "social",
    `✅ Demande d'ami acceptée`,
    `${accepterName} a accepté ta demande d'ami.`,
    `/friends`
  );
}

/**
 * Notifie un vendeur qu'il a reçu un nouvel abonné.
 */
export async function notifyNewFollower(
  sellerId: number,
  followerName: string
): Promise<void> {
  await notify(
    sellerId,
    "social",
    `⭐ Nouvel abonné`,
    `${followerName} suit maintenant ta boutique.`,
    `/dashboard/followers`
  );
}

/**
 * Notifie un user qu'il a reçu un nouveau message.
 */
export async function notifyNewMessage(
  userId: number,
  conversationId: number,
  messageId: number,
  senderFirstName: string,
  preview: string
): Promise<void> {
  await notify(
    userId,
    "message",
    `💬 Nouveau message de ${senderFirstName}`,
    preview,
    `/messages/${conversationId}`
  );
}

// ============================================================
// NOTIFICATIONS ÉVÉNEMENTS (réseau social)
// ============================================================

/**
 * Notifie les amis quand un user organise un nouvel événement.
 */
export async function notifyFriendsNewEvent(
  friendIds: number[],
  eventId: number,
  eventTitle: string,
  organizerName: string
): Promise<void> {
  if (friendIds.length === 0) return;

  await Promise.all(
    friendIds.map((friendId) =>
      notify(
        friendId,
        "social",
        `📅 ${organizerName} organise un événement`,
        `"${eventTitle}" — clique pour voir les détails.`,
        `/events/${eventId}`
      ).catch((err) =>
        console.error(`❌ Erreur notif event ami ${friendId}:`, err)
      )
    )
  );
}

/**
 * Notifie les amis quand un user s'inscrit à un événement.
 */
export async function notifyFriendsNewRegistration(
  friendIds: number[],
  eventId: number,
  eventTitle: string,
  friendName: string
): Promise<void> {
  if (friendIds.length === 0) return;

  await Promise.all(
    friendIds.map((friendId) =>
      notify(
        friendId,
        "social",
        `🎟️ ${friendName} participe à un événement`,
        `"${eventTitle}" — rejoins-le !`,
        `/events/${eventId}`
      ).catch((err) =>
        console.error(`❌ Erreur notif inscription ami ${friendId}:`, err)
      )
    )
  );
}

/**
 * Notifie l'organisateur quand quelqu'un like son événement.
 */
export async function notifyEventLiked(
  organizerId: number,
  eventId: number,
  eventTitle: string,
  likerName: string
): Promise<void> {
  await notify(
    organizerId,
    "social",
    `❤️ ${likerName} a aimé ton événement`,
    `"${eventTitle}"`,
    `/events/${eventId}`
  );
}
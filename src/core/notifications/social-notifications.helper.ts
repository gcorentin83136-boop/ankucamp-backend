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
  likerName: string,
  likerId?: number
): Promise<void> {
  await notify(
    postAuthorId,
    "social",
    `❤️ ${likerName} a aimé ton post`,
    `Ton post a reçu un nouveau like.`,
    `/posts/${postId}`,
    likerId ? { actorId: likerId } : undefined
  );
}

/**
 * Notifie un user qu'il a reçu un commentaire sur son post.
 */
export async function notifyPostCommented(
  postAuthorId: number,
  postId: number,
  commenterName: string,
  commenterId?: number
): Promise<void> {
  await notify(
    postAuthorId,
    "social",
    `💬 ${commenterName} a commenté ton post`,
    `Clique pour voir le commentaire.`,
    `/posts/${postId}`,
    commenterId ? { actorId: commenterId } : undefined
  );
}

/**
 * Notifie un user que son commentaire a reçu une réponse.
 */
export async function notifyCommentReplied(
  commentAuthorId: number,
  postId: number,
  replierName: string,
  replierId?: number
): Promise<void> {
  await notify(
    commentAuthorId,
    "social",
    `↩️ ${replierName} a répondu à ton commentaire`,
    `Clique pour voir la réponse.`,
    `/posts/${postId}`,
    replierId ? { actorId: replierId } : undefined
  );
}

/**
 * Notifie un user qu'il a été mentionné dans un post ou commentaire.
 */
export async function notifyMentioned(
  userId: number,
  postId: number,
  mentionerName: string,
  mentionerId?: number
): Promise<void> {
  await notify(
    userId,
    "social",
    `📣 ${mentionerName} t'a mentionné`,
    `Clique pour voir la mention.`,
    `/posts/${postId}`,
    mentionerId ? { actorId: mentionerId } : undefined
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
    `/friends?tab=requests`,
    { actorId: requesterId }
  );
}

/**
 * Notifie un user que sa demande d'ami a été acceptée.
 */
export async function notifyFriendAccepted(
  requesterId: number,
  accepterName: string,
  accepterId?: number
): Promise<void> {
  await notify(
    requesterId,
    "social",
    `✅ Demande d'ami acceptée`,
    `${accepterName} a accepté ta demande d'ami.`,
    `/friends`,
    accepterId ? { actorId: accepterId } : undefined
  );
}

/**
 * Notifie un vendeur qu'il a reçu un nouvel abonné.
 */
export async function notifyNewFollower(
  sellerId: number,
  followerName: string,
  followerId?: number
): Promise<void> {
  await notify(
    sellerId,
    "social",
    `⭐ Nouvel abonné`,
    `${followerName} suit maintenant ta boutique.`,
    `/dashboard/shop`,
    followerId ? { actorId: followerId } : undefined
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
  preview: string,
  senderId?: number
): Promise<void> {
  await notify(
    userId,
    "message",
    `💬 Nouveau message de ${senderFirstName}`,
    preview,
    `/messages/${conversationId}`,
    senderId ? { actorId: senderId } : undefined
  );
}

// ============================================================
// NOTIFICATIONS ÉVÉNEMENTS
// ============================================================

/**
 * Notifie les amis quand un user organise un nouvel événement.
 */
export async function notifyFriendsNewEvent(
  friendIds: number[],
  eventId: number,
  eventTitle: string,
  organizerName: string,
  organizerId?: number
): Promise<void> {
  if (friendIds.length === 0) return;

  await Promise.all(
    friendIds.map((friendId) =>
      notify(
        friendId,
        "social",
        `📅 ${organizerName} organise un événement`,
        `"${eventTitle}" — clique pour voir les détails.`,
        `/events?event=${eventId}`,
        organizerId ? { actorId: organizerId } : undefined
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
  friendName: string,
  registrantId?: number
): Promise<void> {
  if (friendIds.length === 0) return;

  await Promise.all(
    friendIds.map((friendId) =>
      notify(
        friendId,
        "social",
        `🎟️ ${friendName} participe à un événement`,
        `"${eventTitle}" — rejoins-le !`,
        `/events?event=${eventId}`,
        registrantId ? { actorId: registrantId } : undefined
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
  likerName: string,
  likerId?: number
): Promise<void> {
  await notify(
    organizerId,
    "social",
    `❤️ ${likerName} a aimé ton événement`,
    `"${eventTitle}"`,
    `/events?event=${eventId}`,
    likerId ? { actorId: likerId } : undefined
  );
}

/**
 * Notifie les amis qu'un user a publié un nouveau post.
 */
export async function notifyFriendsNewPost(
  friendIds: number[],
  postId: number,
  authorName: string,
  preview: string,
  authorId?: number
): Promise<void> {
  if (friendIds.length === 0) return;

  const shortPreview = preview.trim().slice(0, 100) || "Clique pour voir le post";

  await Promise.all(
    friendIds.map((friendId) =>
      notify(
        friendId,
        "social",
        `📝 ${authorName} a publié un post`,
        shortPreview,
        `/feed?post=${postId}`,
        authorId ? { actorId: authorId } : undefined
      ).catch((err) =>
        console.error(`❌ Erreur notif post ami ${friendId}:`, err)
      )
    )
  );
}
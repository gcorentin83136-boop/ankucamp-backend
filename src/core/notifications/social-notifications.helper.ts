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
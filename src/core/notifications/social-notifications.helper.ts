import { notify } from "./notifications.helper";
import { db } from "../../db";
import { users, stories } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";

// ... (tes fonctions existantes : notifyPostLiked, notifyFriendRequest, etc.)

// ============================================================
// NOTIFICATIONS STORIES
// ============================================================

/**
 * Notifie les utilisateurs tagués dans une story.
 */
export async function notifyStoryTags(
  storyId: number,
  authorId: number,
  elementsJson: string | null
): Promise<void> {
  if (!elementsJson) return;

  try {
    const elements = JSON.parse(elementsJson);
    const mentions = elements
      .filter((el: any) => el.type === 'mention')
      .map((el: any) => el.content.replace('@', ''));

    if (mentions.length === 0) return;

    const taggedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.username, mentions));

    const [author] = await db
      .select({ first_name: users.first_name, last_name: users.last_name })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    const authorName = author ? `${author.first_name} ${author.last_name}` : "Quelqu'un";

    await Promise.all(
      taggedUsers.map((user) =>
        notify(
          user.id,
          "social",
          "Nouvelle mention",
          `📸 ${authorName} t'a tagué dans sa story !`,
          `/stories/${storyId}`,
          { actorId: authorId }
        ).catch((err) => console.error(`❌ Erreur notif tag story ${user.id}:`, err))
      )
    );
  } catch (err) {
    console.error("❌ Erreur notifyStoryTags:", err);
  }
}

/**
 * Notifie le créateur de la story qu'un utilisateur a réagi.
 */
export async function notifyStoryReaction(
  storyId: number,
  reactorId: number,
  authorId: number,
  emoji: string
): Promise<void> {
  if (reactorId === authorId) return;

  try {
    const [reactor] = await db
      .select({ first_name: users.first_name, last_name: users.last_name })
      .from(users)
      .where(eq(users.id, reactorId))
      .limit(1);

    const reactorName = reactor ? `${reactor.first_name} ${reactor.last_name}` : "Quelqu'un";

    await notify(
      authorId,
      "social",
      "Nouvelle réaction",
      `${emoji} ${reactorName} a réagi à ta story !`,
      `/stories/${storyId}`,
      { actorId: reactorId }
    );
  } catch (err) {
    console.error("❌ Erreur notifyStoryReaction:", err);
  }
}
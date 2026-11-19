import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "../../db";
import {
  eventComments,
  eventCommentReactions,
  events,
  users,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getBadgesForUsers } from "../badges/badges.service";
import { notify } from "../../notifications/notifications.helper";
import type { CreateCommentInput } from "./events.comments.validation";

async function getEventOr404(eventId: number) {
  const [e] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!e) throw new AppError("Événement introuvable", 404);
  return e;
}

async function enrichComments(
  comments: any[],
  viewerId?: number
): Promise<any[]> {
  if (comments.length === 0) return [];

  const authorIds = [...new Set(comments.map((c) => c.author_id))];
  const commentIds = comments.map((c) => c.id);

  const [authors, allReactions, badgesMap] = await Promise.all([
    db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        username: users.username,
        avatar_url: users.avatar_url,
        verification_status: users.verification_status,
      })
      .from(users)
      .where(inArray(users.id, authorIds)),
    db
      .select()
      .from(eventCommentReactions)
      .where(inArray(eventCommentReactions.comment_id, commentIds)),
    getBadgesForUsers(authorIds),
  ]);

  const authorsMap = new Map(
    authors.map((a) => [a.id, { ...a, badges: badgesMap.get(a.id) ?? [] }])
  );

  const reactionsByComment = new Map<
    number,
    { emoji: string; user_id: number }[]
  >();
  for (const r of allReactions) {
    if (!reactionsByComment.has(r.comment_id)) {
      reactionsByComment.set(r.comment_id, []);
    }
    reactionsByComment.get(r.comment_id)!.push({
      emoji: r.emoji,
      user_id: r.user_id,
    });
  }

  return comments.map((c) => {
    const reactions = reactionsByComment.get(c.id) ?? [];

    const grouped: Record<string, number[]> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      grouped[r.emoji].push(r.user_id);
    }

    const my_reactions: string[] = [];
    if (viewerId) {
      for (const [emoji, userIds] of Object.entries(grouped)) {
        if (userIds.includes(viewerId)) my_reactions.push(emoji);
      }
    }

    return {
      ...c,
      author: authorsMap.get(c.author_id) ?? null,
      reactions: grouped,
      my_reactions,
      replies: [] as any[],
    };
  });
}

function buildCommentTree(comments: any[]): any[] {
  const map = new Map<number, any>();
  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  const roots: any[] = [];
  for (const c of comments) {
    const node = map.get(c.id);
    if (c.parent_comment_id) {
      const parent = map.get(c.parent_comment_id);
      if (parent) parent.replies.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function notifyCommentAuthor(
  recipientId: number,
  commenterId: number,
  eventId: number,
  eventTitle: string,
  isReply: boolean,
  targetCommentId: number
) {
  if (recipientId === commenterId) return;

  try {
    const [commenter] = await db
      .select({
        first_name: users.first_name,
        last_name: users.last_name,
      })
      .from(users)
      .where(eq(users.id, commenterId))
      .limit(1);

    const name = commenter
      ? `${commenter.first_name} ${commenter.last_name}`
      : "Quelqu'un";

    const title = isReply
      ? "Nouvelle réponse à ton commentaire"
      : "Nouveau commentaire";

    const content = isReply
      ? `${name} a répondu à ton commentaire sur "${eventTitle}".`
      : `${name} a commenté ton événement "${eventTitle}".`;

    await notify(
      recipientId,
      "social",
      title,
      content,
      `/events/${eventId}#comment-${targetCommentId}`,
      { actorId: commenterId }
    );
  } catch (err) {
    console.error("❌ Erreur notif comment event:", err);
  }
}

export async function listEventComments(eventId: number, viewerId?: number) {
  await getEventOr404(eventId);

  const rows = await db
    .select()
    .from(eventComments)
    .where(eq(eventComments.event_id, eventId))
    .orderBy(asc(eventComments.created_at));

  const enriched = await enrichComments(rows, viewerId);
  return buildCommentTree(enriched);
}

export async function createEventComment(
  eventId: number,
  authorId: number,
  input: CreateCommentInput
) {
  const event = await getEventOr404(eventId);

  let parentAuthorId: number | null = null;

  if (input.parent_comment_id) {
    const [parent] = await db
      .select()
      .from(eventComments)
      .where(eq(eventComments.id, input.parent_comment_id))
      .limit(1);

    if (!parent) throw new AppError("Commentaire parent introuvable", 404);
    if (parent.event_id !== eventId) {
      throw new AppError(
        "Le commentaire parent n'appartient pas à cet événement",
        400
      );
    }
    parentAuthorId = parent.author_id;
  }

  const [created] = await db
    .insert(eventComments)
    .values({
      event_id: eventId,
      author_id: authorId,
      content: input.content,
      media_url: input.media_url || null,
      parent_comment_id: input.parent_comment_id ?? null,
    })
    .returning();

  if (input.parent_comment_id && parentAuthorId) {
    await notifyCommentAuthor(
      parentAuthorId,
      authorId,
      event.id,
      event.title,
      true,
      created.id
    );
  } else {
    await notifyCommentAuthor(
      event.organizer_id,
      authorId,
      event.id,
      event.title,
      false,
      created.id
    );
  }

  const [enriched] = await enrichComments([created], authorId);
  return enriched;
}

export async function updateEventComment(
  commentId: number,
  userId: number,
  content: string
) {
  const [comment] = await db
    .select()
    .from(eventComments)
    .where(eq(eventComments.id, commentId))
    .limit(1);

  if (!comment) throw new AppError("Commentaire introuvable", 404);
  if (comment.author_id !== userId) {
    throw new AppError("Tu ne peux modifier que tes commentaires", 403);
  }

  const [updated] = await db
    .update(eventComments)
    .set({ content, updated_at: new Date() })
    .where(eq(eventComments.id, commentId))
    .returning();

  const [enriched] = await enrichComments([updated], userId);
  return enriched;
}

export async function deleteEventComment(commentId: number, userId: number) {
  const [comment] = await db
    .select()
    .from(eventComments)
    .where(eq(eventComments.id, commentId))
    .limit(1);

  if (!comment) throw new AppError("Commentaire introuvable", 404);
  if (comment.author_id !== userId) {
    throw new AppError("Tu ne peux supprimer que tes commentaires", 403);
  }

  const children = await db
    .select({ id: eventComments.id })
    .from(eventComments)
    .where(eq(eventComments.parent_comment_id, commentId));

  const allIds = [commentId, ...children.map((c) => c.id)];

  await db
    .delete(eventCommentReactions)
    .where(inArray(eventCommentReactions.comment_id, allIds));

  await db
    .delete(eventComments)
    .where(inArray(eventComments.id, allIds));

  return { deleted: allIds.length };
}

export async function toggleEventCommentReaction(
  commentId: number,
  userId: number,
  emoji: string
) {
  const [comment] = await db
    .select()
    .from(eventComments)
    .where(eq(eventComments.id, commentId))
    .limit(1);

  if (!comment) throw new AppError("Commentaire introuvable", 404);

  const [existing] = await db
    .select()
    .from(eventCommentReactions)
    .where(
      and(
        eq(eventCommentReactions.comment_id, commentId),
        eq(eventCommentReactions.user_id, userId),
        eq(eventCommentReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(eventCommentReactions)
      .where(eq(eventCommentReactions.id, existing.id));
    return { action: "removed", emoji };
  }

  await db.insert(eventCommentReactions).values({
    comment_id: commentId,
    user_id: userId,
    emoji,
  });

  if (comment.author_id !== userId) {
    try {
      const [event] = await db
        .select({ title: events.title })
        .from(events)
        .where(eq(events.id, comment.event_id))
        .limit(1);

      if (event) {
        const [reactor] = await db
          .select({ first_name: users.first_name, last_name: users.last_name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const name = reactor ? `${reactor.first_name} ${reactor.last_name}` : "Quelqu'un";

        await notify(
          comment.author_id,
          "social",
          `❤️ ${name} a réagi à ton commentaire`,
          `Sur l'événement "${event.title}".`,
          `/events/${comment.event_id}#comment-${commentId}`,
          { actorId: userId }
        );
      }
    } catch (err) {
      console.error("❌ Erreur notif réaction commentaire event:", err);
    }
  }

  return { action: "added", emoji };
}
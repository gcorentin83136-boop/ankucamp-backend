// ============================================================
// ANKU — Service Commentaires d'articles
// ============================================================
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  articleComments,
  articleCommentReactions,
  articles,
  users,
  notifications,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getBadgesForUsers } from "../badges/badges.service";
import type { CreateCommentInput } from "./articles.comments.validation";

// ============================================================
// HELPERS
// ============================================================

async function getArticleOr404(articleId: number) {
  const [a] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!a) throw new AppError("Article introuvable", 404);
  return a;
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
      .from(articleCommentReactions)
      .where(inArray(articleCommentReactions.comment_id, commentIds)),
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
  articleId: number,
  articleTitle: string,
  isReply: boolean
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

    await db.insert(notifications).values({
      user_id: recipientId,
      type: "comment",
      title: isReply
        ? "Nouvelle réponse à ton commentaire"
        : "Nouveau commentaire",
      content: isReply
        ? `${name} a répondu à ton commentaire sur "${articleTitle}".`
        : `${name} a commenté ton article "${articleTitle}".`,
      link: `/articles/${articleId}`,
    });
  } catch (err) {
    console.error("❌ Erreur notif comment:", err);
  }
}

// ============================================================
// LECTURE
// ============================================================

export async function listArticleComments(
  articleId: number,
  viewerId?: number
) {
  await getArticleOr404(articleId);

  const rows = await db
    .select()
    .from(articleComments)
    .where(eq(articleComments.article_id, articleId))
    .orderBy(asc(articleComments.created_at));

  const enriched = await enrichComments(rows, viewerId);
  return buildCommentTree(enriched);
}

// ============================================================
// CRÉATION
// ============================================================

export async function createArticleComment(
  articleId: number,
  authorId: number,
  input: CreateCommentInput
) {
  const article = await getArticleOr404(articleId);

  if (input.parent_comment_id) {
    const [parent] = await db
      .select()
      .from(articleComments)
      .where(eq(articleComments.id, input.parent_comment_id))
      .limit(1);

    if (!parent) throw new AppError("Commentaire parent introuvable", 404);
    if (parent.article_id !== articleId) {
      throw new AppError(
        "Le commentaire parent n'appartient pas à cet article",
        400
      );
    }

    await notifyCommentAuthor(
      parent.author_id,
      authorId,
      articleId,
      article.title,
      true
    );
  } else {
    await notifyCommentAuthor(
      article.author_id,
      authorId,
      articleId,
      article.title,
      false
    );
  }

  const [created] = await db
    .insert(articleComments)
    .values({
      article_id: articleId,
      author_id: authorId,
      content: input.content,
      media_url: input.media_url || null,
      parent_comment_id: input.parent_comment_id ?? null,
    })
    .returning();

  const [enriched] = await enrichComments([created], authorId);
  return enriched;
}

// ============================================================
// MODIFICATION / SUPPRESSION
// ============================================================

export async function updateArticleComment(
  commentId: number,
  userId: number,
  content: string
) {
  const [comment] = await db
    .select()
    .from(articleComments)
    .where(eq(articleComments.id, commentId))
    .limit(1);

  if (!comment) throw new AppError("Commentaire introuvable", 404);
  if (comment.author_id !== userId) {
    throw new AppError("Tu ne peux modifier que tes commentaires", 403);
  }

  const [updated] = await db
    .update(articleComments)
    .set({ content, updated_at: new Date() })
    .where(eq(articleComments.id, commentId))
    .returning();

  const [enriched] = await enrichComments([updated], userId);
  return enriched;
}

export async function deleteArticleComment(commentId: number, userId: number) {
  const [comment] = await db
    .select()
    .from(articleComments)
    .where(eq(articleComments.id, commentId))
    .limit(1);

  if (!comment) throw new AppError("Commentaire introuvable", 404);
  if (comment.author_id !== userId) {
    throw new AppError("Tu ne peux supprimer que tes commentaires", 403);
  }

  const children = await db
    .select({ id: articleComments.id })
    .from(articleComments)
    .where(eq(articleComments.parent_comment_id, commentId));

  const allIds = [commentId, ...children.map((c) => c.id)];

  await db
    .delete(articleCommentReactions)
    .where(inArray(articleCommentReactions.comment_id, allIds));

  await db
    .delete(articleComments)
    .where(inArray(articleComments.id, allIds));

  return { deleted: allIds.length };
}

// ============================================================
// RÉACTIONS EMOJI
// ============================================================

export async function toggleCommentReaction(
  commentId: number,
  userId: number,
  emoji: string
) {
  const [comment] = await db
    .select()
    .from(articleComments)
    .where(eq(articleComments.id, commentId))
    .limit(1);

  if (!comment) throw new AppError("Commentaire introuvable", 404);

  const [existing] = await db
    .select()
    .from(articleCommentReactions)
    .where(
      and(
        eq(articleCommentReactions.comment_id, commentId),
        eq(articleCommentReactions.user_id, userId),
        eq(articleCommentReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(articleCommentReactions)
      .where(eq(articleCommentReactions.id, existing.id));
    return { action: "removed", emoji };
  }

  await db.insert(articleCommentReactions).values({
    comment_id: commentId,
    user_id: userId,
    emoji,
  });

  return { action: "added", emoji };
}

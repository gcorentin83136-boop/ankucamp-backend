import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  posts,
  postLikes,
  postComments,
  postShares,
  users,
  friendships,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import {
  notifyPostLiked,
  notifyPostCommented,
  notifyCommentReplied,
} from "../../notifications/social-notifications.helper";
import { getBadgesForUsers, getUserBadges } from "../badges/badges.service";
import type {
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  SharePostInput,
  ListPostsQuery,
} from "./posts.validation";

// ============================================================
// HELPERS PRIVÉS
// ============================================================

async function getFriendIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({
      requester_id: friendships.requester_id,
      receiver_id: friendships.receiver_id,
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
    );

  return rows.map((r) =>
    r.requester_id === userId ? r.receiver_id : r.requester_id
  );
}

async function areFriends(userA: number, userB: number): Promise<boolean> {
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        or(
          and(
            eq(friendships.requester_id, userA),
            eq(friendships.receiver_id, userB)
          ),
          and(
            eq(friendships.requester_id, userB),
            eq(friendships.receiver_id, userA)
          )
        ),
        eq(friendships.status, "accepted")
      )
    )
    .limit(1);

  return !!row;
}

/**
 * Enrichit un post avec les infos auteur + liked_by_me + badges.
 * `badgesMap` est optionnel (batch anti N+1 pour les listes).
 */
async function enrichPost(
  post: any,
  viewerId?: number,
  badgesMap?: Map<number, string[]>
): Promise<any> {
  const [author] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
      verification_status: users.verification_status,
    })
    .from(users)
    .where(eq(users.id, post.author_id))
    .limit(1);

  const authorBadges = badgesMap
    ? badgesMap.get(post.author_id) ?? []
    : await getUserBadges(post.author_id);

  let likedByMe = false;
  if (viewerId) {
    const [like] = await db
      .select({ id: postLikes.id })
      .from(postLikes)
      .where(
        and(eq(postLikes.post_id, post.id), eq(postLikes.user_id, viewerId))
      )
      .limit(1);
    likedByMe = !!like;
  }

  let sharedFrom: any = null;
  if (post.shared_from_post_id) {
    const [original] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, post.shared_from_post_id))
      .limit(1);

    if (original) {
      const [originalAuthor] = await db
        .select({
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          username: users.username,
          avatar_url: users.avatar_url,
          verification_status: users.verification_status,
        })
        .from(users)
        .where(eq(users.id, original.author_id))
        .limit(1);

      const originalBadges =
        badgesMap?.get(original.author_id) ??
        (await getUserBadges(original.author_id));

      sharedFrom = {
        ...original,
        media_urls: original.media_urls ? JSON.parse(original.media_urls) : [],
        author: originalAuthor
          ? { ...originalAuthor, badges: originalBadges }
          : null,
      };
    }
  }

  return {
    ...post,
    media_urls: post.media_urls ? JSON.parse(post.media_urls) : [],
    author: author ? { ...author, badges: authorBadges } : null,
    liked_by_me: likedByMe,
    shared_from: sharedFrom,
  };
}

// ============================================================
// CRÉATION
// ============================================================

export async function createPost(authorId: number, input: CreatePostInput) {
  const { content, media_urls, visibility } = input;

  if (
    (!content || content.trim() === "") &&
    (!media_urls || media_urls.length === 0)
  ) {
    throw new AppError("Un post doit avoir du texte ou au moins un média", 400);
  }

  const [created] = await db
    .insert(posts)
    .values({
      author_id: authorId,
      content: content ?? null,
      media_urls:
        media_urls && media_urls.length > 0
          ? JSON.stringify(media_urls)
          : null,
      visibility,
    })
    .returning();

  return enrichPost(created, authorId);
}

// ============================================================
// LECTURE
// ============================================================

export async function getPostById(postId: number, viewerId?: number) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new AppError("Post introuvable", 404);

  if (post.visibility === "private" && post.author_id !== viewerId) {
    throw new AppError("Tu n'as pas accès à ce post", 403);
  }

  if (post.visibility === "friends" && viewerId && post.author_id !== viewerId) {
    const friends = await areFriends(viewerId, post.author_id);
    if (!friends) {
      throw new AppError("Tu n'as pas accès à ce post", 403);
    }
  }

  return enrichPost(post, viewerId);
}

export async function getFeed(viewerId: number, query: ListPostsQuery) {
  const { limit, offset } = query;

  const friendIds = await getFriendIds(viewerId);

  const conditions: any[] = [eq(posts.visibility, "public")];

  if (friendIds.length > 0) {
    conditions.push(
      and(eq(posts.visibility, "friends"), inArray(posts.author_id, friendIds))
    );
  }

  conditions.push(eq(posts.author_id, viewerId));

  const rows = await db
    .select()
    .from(posts)
    .where(or(...conditions))
    .orderBy(desc(posts.created_at))
    .limit(limit)
    .offset(offset);

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.author_id));
  return Promise.all(rows.map((p) => enrichPost(p, viewerId, badgesMap)));
}

export async function getUserPosts(
  targetUserId: number,
  viewerId: number,
  query: ListPostsQuery
) {
  const { limit, offset } = query;

  if (targetUserId === viewerId) {
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.author_id, viewerId))
      .orderBy(desc(posts.created_at))
      .limit(limit)
      .offset(offset);

    const badgesMap = await getBadgesForUsers(rows.map((r) => r.author_id));
    return Promise.all(rows.map((p) => enrichPost(p, viewerId, badgesMap)));
  }

  const [target] = await db
    .select({ id: users.id, is_private: users.is_private })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) throw new AppError("Utilisateur introuvable", 404);

  const friends = await areFriends(viewerId, targetUserId);

  if (target.is_private === 1 && !friends) {
    throw new AppError("Ce profil est privé", 403);
  }

  const conditions: any[] = [
    and(eq(posts.author_id, targetUserId), eq(posts.visibility, "public")),
  ];

  if (friends) {
    conditions.push(
      and(eq(posts.author_id, targetUserId), eq(posts.visibility, "friends"))
    );
  }

  const rows = await db
    .select()
    .from(posts)
    .where(or(...conditions))
    .orderBy(desc(posts.created_at))
    .limit(limit)
    .offset(offset);

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.author_id));
  return Promise.all(rows.map((p) => enrichPost(p, viewerId, badgesMap)));
}

export async function getMyPosts(authorId: number, query: ListPostsQuery) {
  const { limit, offset } = query;

  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.author_id, authorId))
    .orderBy(desc(posts.created_at))
    .limit(limit)
    .offset(offset);

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.author_id));
  return Promise.all(rows.map((p) => enrichPost(p, authorId, badgesMap)));
}

// ============================================================
// MODIFICATION / SUPPRESSION
// ============================================================

export async function updatePost(
  postId: number,
  userId: number,
  input: UpdatePostInput
) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new AppError("Post introuvable", 404);
  if (post.author_id !== userId) {
    throw new AppError("Tu ne peux modifier que tes propres posts", 403);
  }

  const updates: any = { updated_at: new Date() };
  if (input.content !== undefined) updates.content = input.content;
  if (input.visibility !== undefined) updates.visibility = input.visibility;

  const [updated] = await db
    .update(posts)
    .set(updates)
    .where(eq(posts.id, postId))
    .returning();

  return enrichPost(updated, userId);
}

export async function deletePost(postId: number, userId: number) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new AppError("Post introuvable", 404);
  if (post.author_id !== userId) {
    throw new AppError("Tu ne peux supprimer que tes propres posts", 403);
  }

  await db.delete(postLikes).where(eq(postLikes.post_id, postId));
  await db.delete(postComments).where(eq(postComments.post_id, postId));
  await db.delete(postShares).where(eq(postShares.post_id, postId));
  await db.delete(posts).where(eq(posts.id, postId));
}

// ============================================================
// LIKES
// ============================================================

export async function toggleLike(postId: number, userId: number) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new AppError("Post introuvable", 404);

  const [existing] = await db
    .select()
    .from(postLikes)
    .where(and(eq(postLikes.post_id, postId), eq(postLikes.user_id, userId)))
    .limit(1);

  if (existing) {
    await db.delete(postLikes).where(eq(postLikes.id, existing.id));
    await db
      .update(posts)
      .set({ likes_count: sql`GREATEST(${posts.likes_count} - 1, 0)` })
      .where(eq(posts.id, postId));

    return { liked: false };
  } else {
    await db.insert(postLikes).values({ post_id: postId, user_id: userId });
    await db
      .update(posts)
      .set({ likes_count: sql`${posts.likes_count} + 1` })
      .where(eq(posts.id, postId));

    if (post.author_id !== userId) {
      const [liker] = await db
        .select({ first_name: users.first_name, last_name: users.last_name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (liker) {
        notifyPostLiked(
          post.author_id,
          postId,
          `${liker.first_name} ${liker.last_name}`
        ).catch((err) => console.error("❌ Erreur notif like:", err));
      }
    }

    return { liked: true };
  }
}

export async function getLikes(postId: number, query: ListPostsQuery) {
  const { limit, offset } = query;

  const rows = await db
    .select({
      id: postLikes.id,
      user_id: postLikes.user_id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
      verification_status: users.verification_status,
      created_at: postLikes.created_at,
    })
    .from(postLikes)
    .leftJoin(users, eq(users.id, postLikes.user_id))
    .where(eq(postLikes.post_id, postId))
    .orderBy(desc(postLikes.created_at))
    .limit(limit)
    .offset(offset);

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    ...r,
    badges: badgesMap.get(r.user_id) ?? [],
  }));
}

// ============================================================
// COMMENTAIRES
// ============================================================

export async function addComment(
  postId: number,
  authorId: number,
  input: CreateCommentInput
) {
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) throw new AppError("Post introuvable", 404);

  if (input.parent_comment_id) {
    const [parent] = await db
      .select()
      .from(postComments)
      .where(eq(postComments.id, input.parent_comment_id))
      .limit(1);

    if (!parent || parent.post_id !== postId) {
      throw new AppError("Commentaire parent introuvable", 404);
    }

    if (parent.parent_comment_id !== null) {
      throw new AppError("Tu ne peux pas répondre à une réponse", 400);
    }
  }

  const [created] = await db
    .insert(postComments)
    .values({
      post_id: postId,
      author_id: authorId,
      content: input.content,
      parent_comment_id: input.parent_comment_id ?? null,
    })
    .returning();

  await db
    .update(posts)
    .set({ comments_count: sql`${posts.comments_count} + 1` })
    .where(eq(posts.id, postId));

  try {
    const [commenter] = await db
      .select({ first_name: users.first_name, last_name: users.last_name })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    const commenterName = commenter
      ? `${commenter.first_name} ${commenter.last_name}`
      : "Quelqu'un";

    if (post.author_id !== authorId) {
      notifyPostCommented(post.author_id, postId, commenterName).catch((err) =>
        console.error("❌ Erreur notif comment:", err)
      );
    }

    if (input.parent_comment_id) {
      const [parent] = await db
        .select({ author_id: postComments.author_id })
        .from(postComments)
        .where(eq(postComments.id, input.parent_comment_id))
        .limit(1);

      if (
        parent &&
        parent.author_id !== authorId &&
        parent.author_id !== post.author_id
      ) {
        notifyCommentReplied(parent.author_id, postId, commenterName).catch(
          (err) => console.error("❌ Erreur notif reply:", err)
        );
      }
    }
  } catch (err) {
    console.error("❌ Erreur traitement notif commentaire:", err);
  }

  return created;
}

export async function getComments(postId: number, query: ListPostsQuery) {
  const { limit, offset } = query;

  const all = await db
    .select({
      id: postComments.id,
      post_id: postComments.post_id,
      author_id: postComments.author_id,
      content: postComments.content,
      parent_comment_id: postComments.parent_comment_id,
      created_at: postComments.created_at,
      author_first_name: users.first_name,
      author_last_name: users.last_name,
      author_username: users.username,
      author_avatar_url: users.avatar_url,
      author_verification_status: users.verification_status,
    })
    .from(postComments)
    .leftJoin(users, eq(users.id, postComments.author_id))
    .where(eq(postComments.post_id, postId))
    .orderBy(postComments.created_at);

  const badgesMap = await getBadgesForUsers(all.map((c) => c.author_id));

  const roots = all.filter((c) => c.parent_comment_id === null);
  const replies = all.filter((c) => c.parent_comment_id !== null);

  const structured = roots.slice(offset, offset + limit).map((root) => ({
    ...root,
    author_badges: badgesMap.get(root.author_id) ?? [],
    replies: replies
      .filter((r) => r.parent_comment_id === root.id)
      .map((r) => ({
        ...r,
        author_badges: badgesMap.get(r.author_id) ?? [],
      })),
  }));

  return structured;
}

export async function deleteComment(commentId: number, userId: number) {
  const [comment] = await db
    .select()
    .from(postComments)
    .where(eq(postComments.id, commentId))
    .limit(1);

  if (!comment) throw new AppError("Commentaire introuvable", 404);

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, comment.post_id))
    .limit(1);

  if (!post) throw new AppError("Post introuvable", 404);

  if (comment.author_id !== userId && post.author_id !== userId) {
    throw new AppError("Tu n'as pas le droit de supprimer ce commentaire", 403);
  }

  await db
    .delete(postComments)
    .where(eq(postComments.parent_comment_id, commentId));
  await db.delete(postComments).where(eq(postComments.id, commentId));

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postComments)
    .where(eq(postComments.post_id, comment.post_id));

  await db
    .update(posts)
    .set({ comments_count: countResult?.count ?? 0 })
    .where(eq(posts.id, post.id));
}

// ============================================================
// PARTAGE
// ============================================================

export async function sharePost(
  postId: number,
  authorId: number,
  input: SharePostInput
) {
  const [original] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!original) throw new AppError("Post introuvable", 404);

  const [created] = await db
    .insert(posts)
    .values({
      author_id: authorId,
      content: input.share_comment ?? null,
      shared_from_post_id: original.id,
      share_comment: input.share_comment ?? null,
      visibility: input.visibility,
    })
    .returning();

  await db
    .update(posts)
    .set({ shares_count: sql`${posts.shares_count} + 1` })
    .where(eq(posts.id, postId));

  await db.insert(postShares).values({
    post_id: postId,
    user_id: authorId,
  });

  return enrichPost(created, authorId);
}
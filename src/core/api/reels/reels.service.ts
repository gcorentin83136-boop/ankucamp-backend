import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { reels, reelLikes, users, events, articles, posts } from "../../db/schema";
import { AppError } from "../../errors/AppError";

export async function createReel(authorId: number, input: any) {
  const [created] = await db.insert(reels).values({
    author_id: authorId,
    media_url: input.media_url,
    media_type: input.media_type || "video",
    caption: input.caption,
    visibility: input.visibility || "public",
    shared_event_id: input.shared_event_id || null,
    shared_article_id: input.shared_article_id || null,
    shared_post_id: input.shared_post_id || null,
  }).returning();
  return enrichReel(created, authorId);
}

export async function getReelsFeed(viewerId: number, limit: number = 20) {
  const rows = await db.select().from(reels)
    .where(eq(reels.visibility, "public"))
    .orderBy(desc(reels.created_at))
    .limit(limit);
    
  return Promise.all(rows.map(r => enrichReel(r, viewerId)));
}

export async function toggleLike(reelId: number, userId: number) {
  const [existing] = await db.select().from(reelLikes)
    .where(and(eq(reelLikes.reel_id, reelId), eq(reelLikes.user_id, userId))).limit(1);
    
  if (existing) {
    await db.delete(reelLikes).where(eq(reelLikes.id, existing.id));
    await db.update(reels).set({ likes_count: sql`GREATEST(${reels.likes_count} - 1, 0)` }).where(eq(reels.id, reelId));
    return { liked: false };
  } else {
    await db.insert(reelLikes).values({ reel_id: reelId, user_id: userId });
    await db.update(reels).set({ likes_count: sql`${reels.likes_count} + 1` }).where(eq(reels.id, reelId));
    return { liked: true };
  }
}

export async function enrichReel(reel: any, viewerId?: number) {
  const [author] = await db.select({ id: users.id, first_name: users.first_name, last_name: users.last_name, username: users.username, avatar_url: users.avatar_url }).from(users).where(eq(users.id, reel.author_id)).limit(1);
  
  let likedByMe = false;
  if (viewerId) {
    const [like] = await db.select().from(reelLikes).where(and(eq(reelLikes.reel_id, reel.id), eq(reelLikes.user_id, viewerId))).limit(1);
    likedByMe = !!like;
  }

  let sharedEvent = null, sharedArticle = null, sharedPost = null;
  if (reel.shared_event_id) [sharedEvent] = await db.select().from(events).where(eq(events.id, reel.shared_event_id)).limit(1);
  if (reel.shared_article_id) [sharedArticle] = await db.select().from(articles).where(eq(articles.id, reel.shared_article_id)).limit(1);
  if (reel.shared_post_id) [sharedPost] = await db.select().from(posts).where(eq(posts.id, reel.shared_post_id)).limit(1);

  return { ...reel, author, liked_by_me: likedByMe, shared_event: sharedEvent, shared_article: sharedArticle, shared_post: sharedPost };
}
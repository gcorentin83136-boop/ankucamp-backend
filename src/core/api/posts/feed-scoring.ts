import { eq, and, sql, gte } from "drizzle-orm";
import { db } from "../../db";
import { postLikes, postComments, posts } from "../../db/schema";

export const FEED_CONFIG = {
  // 🆕 Poids mis à jour : Récence (0.45) et Engagement (0.35) dominent
  weights: { recency: 0.45, engagement: 0.35, affinity: 0.15, interest: 0.05, serendipity: 0.00 },
  recencyHalfLifeHours: 12, // Un post perd sa valeur plus vite (12h au lieu de 24h)
  engagementCap: 500,
  implicitAffinityWindowDays: 30,
  poolMultiplier: 20,
  poolCap: 500,
};

export interface FeedCandidate {
  id: number; author_id: number; content: string | null; media_urls: string | null;
  visibility: string; shared_from_post_id: number | null; shared_event_id: number | null;
  shared_article_id: number | null; share_comment: string | null; likes_count: number; 
  comments_count: number; shares_count: number; created_at: Date | null; updated_at: Date | null;
}

export interface UserContext {
  viewerId: number;
  friendIds: Set<number>;
  interactionCounts: Map<number, number>;
}

export function calculateFeedScore(post: FeedCandidate, ctx: UserContext, now: Date = new Date()) {
  const postDate = post.created_at ? new Date(post.created_at) : new Date();
  const ageMs = Math.max(0, now.getTime() - postDate.getTime());
  const ageHours = ageMs / (1000 * 60 * 60);

  const recency = Math.exp(-ageHours / FEED_CONFIG.recencyHalfLifeHours);
  const rawEngagement = (post.likes_count || 0) + (post.comments_count || 0) * 2 + (post.shares_count || 0) * 3;
  const engagement = Math.log(1 + rawEngagement) / Math.log(1 + FEED_CONFIG.engagementCap);

  let affinity = 0;
  if (post.author_id === ctx.viewerId) affinity = 1.0;
  else if (ctx.friendIds.has(post.author_id)) affinity = 0.8;

  const w = FEED_CONFIG.weights;
  const total = w.recency * recency + w.engagement * engagement + w.affinity * affinity;

  return { total };
}

// ... (getInteractionCounts reste inchangé)
export async function getInteractionCounts(viewerId: number): Promise<Map<number, number>> {
  const since = new Date(Date.now() - FEED_CONFIG.implicitAffinityWindowDays * 24 * 60 * 60 * 1000);
  
  const likes = await db.select({ author_id: posts.author_id, count: sql<number>`count(*)::int` })
    .from(postLikes).innerJoin(posts, eq(posts.id, postLikes.post_id))
    .where(and(eq(postLikes.user_id, viewerId), gte(postLikes.created_at, since))).groupBy(posts.author_id);

  const comments = await db.select({ author_id: posts.author_id, count: sql<number>`count(*)::int` })
    .from(postComments).innerJoin(posts, eq(posts.id, postComments.post_id))
    .where(and(eq(postComments.author_id, viewerId), gte(postComments.created_at, since))).groupBy(posts.author_id);

  const counts = new Map<number, number>();
  for (const r of likes) counts.set(r.author_id, (counts.get(r.author_id) ?? 0) + r.count);
  for (const r of comments) counts.set(r.author_id, (counts.get(r.author_id) ?? 0) + r.count * 2);
  
  return counts;
}
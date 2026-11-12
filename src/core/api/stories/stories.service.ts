import { eq, and, desc, gt, or, inArray, notInArray } from "drizzle-orm";
import { db } from "../../db";
import { stories, users, friendships } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getHiddenUserIds } from "../users/blocks.service";

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

export async function createStory(authorId: number, input: any) {
  const [created] = await db.insert(stories).values({
    author_id: authorId,
    media_url: input.media_url,
    media_type: input.media_type || "video",
    caption: input.caption,
    visibility: input.visibility || "public",
    expires_at: input.expires_at ? new Date(input.expires_at) : new Date(Date.now() + 48 * 60 * 60 * 1000),
    elements: input.elements || null,
  }).returning();
  
  return enrichStory(created, authorId);
}

export async function getStoriesFeed(viewerId: number) {
  const friendIds = await getFriendIds(viewerId);
  const hiddenIds = await getHiddenUserIds(viewerId);

  const visibilityConditions: any[] = [
    eq(stories.visibility, "public"),
    eq(stories.author_id, viewerId)
  ];

  if (friendIds.length > 0) {
    visibilityConditions.push(
      and(eq(stories.visibility, "friends"), inArray(stories.author_id, friendIds))
    );
  }

  let whereClause: any = or(...visibilityConditions);
  if (hiddenIds.length > 0) {
    whereClause = and(whereClause, notInArray(stories.author_id, hiddenIds));
  }

  const rows = await db.select({
    story: stories,
    author: {
      id: users.id, username: users.username, first_name: users.first_name,
      last_name: users.last_name, avatar_url: users.avatar_url,
    }
  })
  .from(stories)
  .innerJoin(users, eq(users.id, stories.author_id))
  .where(and(gt(stories.expires_at, new Date()), whereClause))
  .orderBy(desc(stories.created_at));

  // 🆕 Groupement par utilisateur
  const grouped = new Map<number, { author: any, stories: any[] }>();
  
  for (const row of rows) {
    const authorId = row.author.id;
    if (!grouped.has(authorId)) {
      grouped.set(authorId, { author: row.author, stories: [] });
    }
    grouped.get(authorId)!.stories.push({
      ...row.story,
      elements: row.story.elements ? JSON.parse(row.story.elements) : []
    });
  }

  // On trie les stories de la plus ancienne à la plus récente
  return Array.from(grouped.values()).map(g => ({
    ...g,
    stories: g.stories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }));
}

export async function updateVisibility(storyId: number, userId: number, visibility: string) {
  const [story] = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  if (!story) throw new AppError("Story introuvable", 404);
  if (story.author_id !== userId) throw new AppError("Non autorisé", 403);

  const [updated] = await db.update(stories).set({ visibility }).where(eq(stories.id, storyId)).returning();
  return updated;
}

export async function deleteStory(storyId: number, userId: number) {
  const [story] = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  if (!story) throw new AppError("Story introuvable", 404);
  if (story.author_id !== userId) throw new AppError("Non autorisé", 403);

  await db.delete(stories).where(eq(stories.id, storyId));
  return { success: true };
}

async function enrichStory(story: any, viewerId?: number) {
  const [author] = await db.select({ 
    id: users.id, first_name: users.first_name, last_name: users.last_name, 
    username: users.username, avatar_url: users.avatar_url 
  }).from(users).where(eq(users.id, story.author_id)).limit(1);

  return { 
    ...story, 
    author,
    elements: story.elements ? JSON.parse(story.elements) : []
  };
}
import { eq, and, desc, gt, or, inArray } from "drizzle-orm";
import { db } from "../../db";
import { stories, users, friendships } from "../../db/schema"; // 🆕 Ajout de friendships
import { AppError } from "../../errors/AppError";

// 🆕 Helper pour récupérer les amis
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
  }).returning();
  
  return enrichStory(created, authorId);
}

export async function getStoriesFeed(viewerId: number) {
  const friendIds = await getFriendIds(viewerId);

  // 🆕 Logique de visibilité
  const visibilityConditions: any[] = [
    eq(stories.visibility, "public"),
    eq(stories.author_id, viewerId) // On voit toujours ses propres stories
  ];

  // Si on a des amis, on ajoute la condition pour voir leurs stories "amis"
  if (friendIds.length > 0) {
    visibilityConditions.push(
      and(eq(stories.visibility, "friends"), inArray(stories.author_id, friendIds))
    );
  }

  const rows = await db.select()
    .from(stories)
    .where(
      and(
        gt(stories.expires_at, new Date()), // Pas expiré
        or(...visibilityConditions)         // 🆕 Respecte la visibilité
      )
    )
    .orderBy(desc(stories.created_at));
    
  return Promise.all(rows.map(s => enrichStory(s, viewerId)));
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
    id: users.id, 
    first_name: users.first_name, 
    last_name: users.last_name, 
    username: users.username, 
    avatar_url: users.avatar_url 
  }).from(users).where(eq(users.id, story.author_id)).limit(1);

  return { ...story, author };
}
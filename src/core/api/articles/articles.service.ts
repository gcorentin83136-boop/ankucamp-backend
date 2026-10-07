import {
  eq,
  and,
  desc,
  or,
  sql,
  ilike,
} from "drizzle-orm";
import { db } from "../../db";
import { articles, articleLikes, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { getBadgesForUsers, getUserBadges } from "../badges/badges.service";
import type {
  CreateArticleInput,
  UpdateArticleInput,
  ListArticlesQuery,
} from "./articles.validation";

// ============================================================
// HELPERS
// ============================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200);
}

async function generateUniqueSlug(
  title: string,
  excludeId?: number
): Promise<string> {
  const base = slugify(title) || "article";
  let slug = base;
  let i = 1;

  while (true) {
    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);

    if (!existing || (excludeId && existing.id === excludeId)) return slug;
    slug = `${base}-${i++}`;
  }
}

async function enrichArticle(
  article: any,
  viewerId?: number,
  badgesMap?: Map<number, string[]>
) {
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
    .where(eq(users.id, article.author_id))
    .limit(1);

  const badges = badgesMap
    ? badgesMap.get(article.author_id) ?? []
    : await getUserBadges(article.author_id);

  let liked_by_me = false;
  if (viewerId) {
    const [like] = await db
      .select()
      .from(articleLikes)
      .where(
        and(
          eq(articleLikes.article_id, article.id),
          eq(articleLikes.user_id, viewerId)
        )
      )
      .limit(1);
    liked_by_me = !!like;
  }

  return {
    ...article,
    tags: article.tags ? JSON.parse(article.tags) : [],
    author: author ? { ...author, badges } : null,
    liked_by_me,
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function listArticles(
  query: ListArticlesQuery,
  viewerId?: number
) {
  const { q, category, tag, author_id, sort, limit, offset } = query;

  const conditions: any[] = [eq(articles.status, "published")];

  if (q && q.trim() !== "") {
    const term = `%${q.toLowerCase().trim()}%`;
    conditions.push(
      or(
        ilike(articles.title, term),
        ilike(sql`coalesce(${articles.excerpt}, '')`, term),
        ilike(articles.content, term)
      )
    );
  }

  if (category !== "all") conditions.push(eq(articles.category, category));
  if (author_id) conditions.push(eq(articles.author_id, author_id));

  if (tag) {
    const tagPattern = `%"${tag}"%`;
    conditions.push(sql`${articles.tags}::text LIKE ${tagPattern}`);
  }

  let orderBy;
  switch (sort) {
    case "popular":
      orderBy = desc(articles.likes_count);
      break;
    case "views":
      orderBy = desc(articles.views_count);
      break;
    case "recent":
    default:
      orderBy = desc(articles.published_at);
      break;
  }

  const rows = await db
    .select()
    .from(articles)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const badgesMap = await getBadgesForUsers(rows.map((r) => r.author_id));
  return Promise.all(rows.map((r) => enrichArticle(r, viewerId, badgesMap)));
}

export async function getArticleBySlug(
  slug: string,
  viewerId?: number,
  incrementViews = true
) {
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);

  if (!article) throw new AppError("Article introuvable", 404);

  if (incrementViews) {
    await db
      .update(articles)
      .set({ views_count: sql`${articles.views_count} + 1` })
      .where(eq(articles.id, article.id));
    article.views_count += 1;
  }

  return enrichArticle(article, viewerId);
}

export async function getArticleById(id: number, viewerId?: number) {
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) throw new AppError("Article introuvable", 404);
  return enrichArticle(article, viewerId);
}

export async function getMyArticles(authorId: number) {
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.author_id, authorId))
    .orderBy(desc(articles.created_at));

  return Promise.all(rows.map((r) => enrichArticle(r, authorId)));
}

// ============================================================
// ÉCRITURE
// ============================================================

export async function createArticle(
  authorId: number,
  input: CreateArticleInput
) {
  const slug = await generateUniqueSlug(input.title);

  const [created] = await db
    .insert(articles)
    .values({
      author_id: authorId,
      title: input.title,
      slug,
      excerpt: input.excerpt ?? null,
      content: input.content,
      cover_url: input.cover_url || null,
      tags: input.tags.length > 0 ? JSON.stringify(input.tags) : null,
      category: input.category,
      status: input.status,
      visibility: input.visibility ?? "public",
      published_at: input.status === "published" ? new Date() : null,
    })
    .returning();

  return enrichArticle(created, authorId);
}

export async function updateArticle(
  articleId: number,
  userId: number,
  input: UpdateArticleInput
) {
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) throw new AppError("Article introuvable", 404);
  if (article.author_id !== userId) {
    throw new AppError("Tu ne peux modifier que tes propres articles", 403);
  }

  const dataToUpdate: any = { ...input, updated_at: new Date() };

  if (input.title && input.title !== article.title) {
    dataToUpdate.slug = await generateUniqueSlug(input.title, articleId);
  }

  if (input.tags !== undefined) {
    dataToUpdate.tags =
      input.tags.length > 0 ? JSON.stringify(input.tags) : null;
  }

  if (input.cover_url !== undefined) {
    dataToUpdate.cover_url = input.cover_url || null;
  }

  if (input.status === "published" && !article.published_at) {
    dataToUpdate.published_at = new Date();
  }

  if (input.visibility !== undefined) {
    dataToUpdate.visibility = input.visibility;
  }

  const [updated] = await db
    .update(articles)
    .set(dataToUpdate)
    .where(eq(articles.id, articleId))
    .returning();

  return enrichArticle(updated, userId);
}

export async function deleteArticle(articleId: number, userId: number) {
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) throw new AppError("Article introuvable", 404);
  if (article.author_id !== userId) {
    throw new AppError("Tu ne peux supprimer que tes propres articles", 403);
  }

  await db.delete(articleLikes).where(eq(articleLikes.article_id, articleId));
  await db.delete(articles).where(eq(articles.id, articleId));
}

// ============================================================
// LIKE (toggle)
// ============================================================

export async function toggleArticleLike(articleId: number, userId: number) {
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) throw new AppError("Article introuvable", 404);

  const [existing] = await db
    .select()
    .from(articleLikes)
    .where(
      and(
        eq(articleLikes.article_id, articleId),
        eq(articleLikes.user_id, userId)
      )
    )
    .limit(1);

  if (existing) {
    await db.delete(articleLikes).where(eq(articleLikes.id, existing.id));
    await db
      .update(articles)
      .set({ likes_count: sql`GREATEST(${articles.likes_count} - 1, 0)` })
      .where(eq(articles.id, articleId));
    return { liked: false };
  } else {
    await db
      .insert(articleLikes)
      .values({ article_id: articleId, user_id: userId });
    await db
      .update(articles)
      .set({ likes_count: sql`${articles.likes_count} + 1` })
      .where(eq(articles.id, articleId));
    return { liked: true };
  }
}
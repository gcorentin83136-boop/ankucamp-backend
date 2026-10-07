import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  sharePostSchema,
  shareEventSchema,
  listPostsQuerySchema,
} from "./posts.validation";
import {
  createPost,
  getPostById,
  getFeed,
  getUserPosts,
  getMyPosts,
  updatePost,
  deletePost,
  toggleLike,
  getLikes,
  addComment,
  getComments,
  deleteComment,
  sharePost,
  shareEvent,
  shareArticle,
  toggleEventLike,
} from "./posts.service";

// ============================================================
// HELPERS
// ============================================================

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError("ID invalide", 400);
  return id;
}

function getViewerId(req: AuthRequest): number | undefined {
  return req.user?.id;
}

// ============================================================
// POSTS
// ============================================================

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const post = await createPost(req.user.id, parsed.data);
  return res.status(201).json({ success: true, post });
}

export async function getOne(req: AuthRequest, res: Response) {
  const postId = parseId(req.params.id);
  const post = await getPostById(postId, getViewerId(req));
  return res.json({ success: true, post });
}

export async function feed(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const result = await getFeed(req.user.id, parsed.data);

  return res.json({
    success: true,
    count: result.posts.length,
    posts: result.posts,
    events_from_friends: result.events_from_friends,
  });
}

export async function byUser(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const targetUserId = parseId(req.params.userId);

  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const list = await getUserPosts(targetUserId, req.user.id, parsed.data);
  return res.json({ success: true, count: list.length, posts: list });
}

export async function mine(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const list = await getMyPosts(req.user.id, parsed.data);
  return res.json({ success: true, count: list.length, posts: list });
}

export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const postId = parseId(req.params.id);

  const parsed = updatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const post = await updatePost(postId, req.user.id, parsed.data);
  return res.json({ success: true, message: "Post modifié", post });
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const postId = parseId(req.params.id);
  await deletePost(postId, req.user.id);
  return res.status(204).send();
}

// ============================================================
// LIKES
// ============================================================

export async function like(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const postId = parseId(req.params.id);
  const result = await toggleLike(postId, req.user.id);

  return res.json({
    success: true,
    message: result.liked ? "Post liké" : "Like retiré",
    liked: result.liked,
  });
}

export async function likes(req: AuthRequest, res: Response) {
  const postId = parseId(req.params.id);

  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const list = await getLikes(postId, parsed.data);
  return res.json({ success: true, count: list.length, likes: list });
}

// ============================================================
// COMMENTAIRES
// ============================================================

export async function addCommentCtrl(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const postId = parseId(req.params.id);

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const comment = await addComment(postId, req.user.id, parsed.data);
  return res.status(201).json({ success: true, comment });
}

export async function comments(req: AuthRequest, res: Response) {
  const postId = parseId(req.params.id);

  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const list = await getComments(postId, parsed.data);
  return res.json({ success: true, count: list.length, comments: list });
}

export async function removeComment(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const commentId = parseId(req.params.commentId);
  await deleteComment(commentId, req.user.id);
  return res.status(204).send();
}

// ============================================================
// PARTAGE DE POST
// ============================================================

export async function share(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const postId = parseId(req.params.id);

  const parsed = sharePostSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const post = await sharePost(postId, req.user.id, parsed.data);
  return res.status(201).json({ success: true, message: "Post partagé", post });
}

// ============================================================
// PARTAGE D'ÉVÉNEMENT
// ============================================================

export async function shareEventCtrl(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const eventId = parseId(req.params.eventId);

  const parsed = shareEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Données invalides", 400, parsed.error.flatten().fieldErrors);
  }

  const post = await shareEvent(eventId, req.user.id, parsed.data);
  return res.status(201).json({ success: true, message: "Événement partagé", post });
}

// ============================================================
// LIKE SUR ÉVÉNEMENT (toggle)
// ============================================================

export async function likeEvent(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const eventId = parseId(req.params.eventId);
  const result = await toggleEventLike(eventId, req.user.id);

  return res.json({
    success: true,
    message: result.liked ? "Événement liké" : "Like retiré",
    liked: result.liked,
    likes_count: result.likes_count,
  });
}

// ============================================================
// PARTAGER UN ARTICLE (POST /posts/share-article/:articleId)
// ============================================================
export async function shareArticleCtrl(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const articleId = parseId(req.params.articleId);

  const parsed = shareEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const post = await shareArticle(articleId, req.user.id, parsed.data);
  return res.status(201).json({ success: true, post });
}
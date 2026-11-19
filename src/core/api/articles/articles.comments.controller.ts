// ============================================================
// ANKU — Controller Commentaires d'articles
// ============================================================
import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createCommentSchema,
  updateCommentSchema,
  reactCommentSchema,
} from "./articles.comments.validation";
import {
  listArticleComments,
  createArticleComment,
  updateArticleComment,
  deleteArticleComment,
  toggleCommentReaction,
} from "./articles.comments.service";

export async function listComments(req: Request, res: Response) {
  const articleId = Number(req.params.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    throw new AppError("ID article invalide", 400);
  }

  const viewerId = (req as AuthRequest).user?.id;
  const comments = await listArticleComments(articleId, viewerId);

  const total = comments.reduce(
    (sum, c) => sum + 1 + (c.replies?.length ?? 0),
    0
  );

  return res.json({ success: true, count: total, comments });
}

export async function createComment(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const articleId = Number(req.params.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    throw new AppError("ID article invalide", 400);
  }

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const comment = await createArticleComment(
    articleId,
    req.user.id,
    parsed.data
  );
  return res.status(201).json({ success: true, comment });
}

export async function updateComment(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw new AppError("ID commentaire invalide", 400);
  }

  const parsed = updateCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const comment = await updateArticleComment(
    commentId,
    req.user.id,
    parsed.data.content
  );
  return res.json({ success: true, comment });
}

export async function removeComment(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw new AppError("ID commentaire invalide", 400);
  }

  const result = await deleteArticleComment(commentId, req.user.id);
  return res.json({ success: true, ...result });
}

export async function reactComment(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw new AppError("ID commentaire invalide", 400);
  }

  const parsed = reactCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await toggleCommentReaction(
    commentId,
    req.user.id,
    parsed.data.emoji
  );
  return res.json({ success: true, ...result });
}

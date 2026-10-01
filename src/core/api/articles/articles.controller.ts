import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createArticleSchema,
  updateArticleSchema,
  listArticlesQuerySchema,
} from "./articles.validation";
import {
  listArticles,
  getArticleBySlug,
  getMyArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  toggleArticleLike,
} from "./articles.service";

export async function list(req: Request, res: Response) {
  const parsed = listArticlesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const viewerId = (req as AuthRequest).user?.id;
  const list = await listArticles(parsed.data, viewerId);
  return res.json({ success: true, count: list.length, articles: list });
}

export async function getBySlug(req: Request, res: Response) {
  const slug = req.params.slug;
  if (!slug) throw new AppError("Slug manquant", 400);
  const viewerId = (req as AuthRequest).user?.id;
  const article = await getArticleBySlug(slug, viewerId);
  return res.json({ success: true, article });
}

export async function myArticles(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getMyArticles(req.user.id);
  return res.json({ success: true, count: list.length, articles: list });
}

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const article = await createArticle(req.user.id, parsed.data);
  return res.status(201).json({ success: true, article });
}

export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = updateArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const article = await updateArticle(id, req.user.id, parsed.data);
  return res.json({ success: true, article });
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  await deleteArticle(id, req.user.id);
  return res.status(204).send();
}

export async function like(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const result = await toggleArticleLike(id, req.user.id);
  return res.json({
    success: true,
    liked: result.liked,
    message: result.liked ? "Article liké" : "Like retiré",
  });
}
import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { listCategoriesQuerySchema } from "./categories.validation";
import {
  listCategories,
  getCategory,
  getCategoryBySlug,
} from "./categories.service";

export async function list(req: Request, res: Response) {
  const parsed = listCategoriesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const cats = await listCategories(parsed.data);
  return res.json({ success: true, count: cats.length, categories: cats });
}

export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
  const cat = await getCategory(id);
  return res.json({ success: true, category: cat });
}

export async function getBySlug(req: Request, res: Response) {
  const slug = req.params.slug;
  if (!slug) throw new AppError("Slug manquant", 400);
  const cat = await getCategoryBySlug(slug);
  return res.json({ success: true, category: cat });
}
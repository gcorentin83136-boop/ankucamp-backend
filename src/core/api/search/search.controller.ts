import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import {
  searchUsersQuerySchema,
  searchShopsQuerySchema,
  searchProductsQuerySchema,
  searchAllQuerySchema,
  suggestQuerySchema,
} from "./search.validation";
import {
  searchUsers,
  searchShops,
  searchProducts,
  searchAll,
  suggest,
} from "./search.service";

export async function users(req: Request, res: Response) {
  const parsed = searchUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const results = await searchUsers(parsed.data);

  return res.json({
    success: true,
    count: results.length,
    query: parsed.data.q ?? null,
    results,
  });
}

export async function shops(req: Request, res: Response) {
  const parsed = searchShopsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const results = await searchShops(parsed.data);

  return res.json({
    success: true,
    count: results.length,
    query: parsed.data.q ?? null,
    results,
  });
}

export async function products(req: Request, res: Response) {
  const parsed = searchProductsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const results = await searchProducts(parsed.data);

  return res.json({
    success: true,
    count: results.length,
    query: parsed.data.q ?? null,
    results,
  });
}

export async function all(req: Request, res: Response) {
  const parsed = searchAllQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const results = await searchAll(parsed.data);

  return res.json({
    success: true,
    query: parsed.data.q,
    counts: {
      users: results.users.length,
      shops: results.shops.length,
      products: results.products.length,
    },
    ...results,
  });
}

export async function suggestCtrl(req: Request, res: Response) {
  const parsed = suggestQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const results = await suggest(parsed.data);

  return res.json({
    success: true,
    query: parsed.data.q,
    ...results,
  });
}
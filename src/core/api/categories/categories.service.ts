import { eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { categories, shopCategories } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesQuery,
} from "./categories.validation";

// ============================================================
// HELPERS
// ============================================================

async function getCategoryById(id: number) {
  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!cat) throw new AppError("Catégorie introuvable", 404);
  return cat;
}

async function enrichCategory(cat: any) {
  const [row] = await db
    .select({
      shops_count: sql<number>`(
        SELECT COUNT(DISTINCT shop_id)::int
        FROM shop_categories
        WHERE category_id = ${cat.id}
      )`,
    })
    .from(categories)
    .where(eq(categories.id, cat.id));

  return {
    ...cat,
    shops_count: row?.shops_count ?? 0,
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function listCategories(query: ListCategoriesQuery) {
  const { q, limit, offset } = query;

  const conditions: any[] = [];
  if (q && q.trim() !== "") {
    const term = `%${q.toLowerCase().trim()}%`;
    conditions.push(
      or(ilike(categories.name, term), ilike(categories.slug, term))
    );
  }

  const rows = await db
    .select()
    .from(categories)
    .where(conditions.length > 0 ? conditions[0] : sql`1=1`)
    .orderBy(categories.name)
    .limit(limit)
    .offset(offset);

  return Promise.all(rows.map(enrichCategory));
}

export async function getCategory(id: number) {
  const cat = await getCategoryById(id);
  return enrichCategory(cat);
}

export async function getCategoryBySlug(slug: string) {
  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (!cat) throw new AppError("Catégorie introuvable", 404);
  return enrichCategory(cat);
}

// ============================================================
// CRUD (admin)
// ============================================================

export async function createCategory(input: CreateCategoryInput) {
  const [existingSlug] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, input.slug))
    .limit(1);
  if (existingSlug) throw new AppError("Ce slug existe déjà", 409);

  const [existingName] = await db
    .select()
    .from(categories)
    .where(eq(categories.name, input.name))
    .limit(1);
  if (existingName) throw new AppError("Ce nom existe déjà", 409);

  const [created] = await db
    .insert(categories)
    .values({
      name: input.name,
      slug: input.slug,
      icon: input.icon ?? null,
      image_url: input.image_url || null,
    })
    .returning();

  return created;
}

export async function updateCategory(
  id: number,
  input: UpdateCategoryInput
) {
  await getCategoryById(id);

  if (input.slug) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, input.slug))
      .limit(1);
    if (existing && existing.id !== id) {
      throw new AppError("Ce slug est déjà utilisé", 409);
    }
  }

  if (input.name) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, input.name))
      .limit(1);
    if (existing && existing.id !== id) {
      throw new AppError("Ce nom est déjà utilisé", 409);
    }
  }

  const dataToUpdate: any = { ...input };
  if (input.image_url !== undefined) {
    dataToUpdate.image_url = input.image_url || null;
  }

  const [updated] = await db
    .update(categories)
    .set(dataToUpdate)
    .where(eq(categories.id, id))
    .returning();

  return updated;
}

export async function deleteCategory(id: number) {
  await getCategoryById(id);

  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shopCategories)
    .where(eq(shopCategories.category_id, id));

  if ((usage?.count ?? 0) > 0) {
    throw new AppError(
      `Impossible de supprimer : ${usage!.count} boutique(s) utilisent cette catégorie`,
      400
    );
  }

  await db.delete(categories).where(eq(categories.id, id));
}
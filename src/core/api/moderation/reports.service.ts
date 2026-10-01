import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  contentReports,
  users,
  posts,
  postComments,
  reviews,
  products,
  shops,
  messages,
  notifications,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type {
  CreateReportInput,
  ListReportsQuery,
  ReportTargetType,
} from "./reports.validation";

async function getTargetOwnerId(
  type: ReportTargetType,
  id: number
): Promise<number | null> {
  switch (type) {
    case "post": {
      const [row] = await db
        .select({ author_id: posts.author_id })
        .from(posts)
        .where(eq(posts.id, id))
        .limit(1);
      return row?.author_id ?? null;
    }
    case "comment": {
      const [row] = await db
        .select({ author_id: postComments.author_id })
        .from(postComments)
        .where(eq(postComments.id, id))
        .limit(1);
      return row?.author_id ?? null;
    }
    case "review": {
      const [row] = await db
        .select({ author_id: reviews.author_id })
        .from(reviews)
        .where(eq(reviews.id, id))
        .limit(1);
      return row?.author_id ?? null;
    }
    case "product": {
      const [row] = await db
        .select({ owner_id: shops.owner_id })
        .from(products)
        .innerJoin(shops, eq(shops.id, products.shop_id))
        .where(eq(products.id, id))
        .limit(1);
      return row?.owner_id ?? null;
    }
    case "shop": {
      const [row] = await db
        .select({ owner_id: shops.owner_id })
        .from(shops)
        .where(eq(shops.id, id))
        .limit(1);
      return row?.owner_id ?? null;
    }
    case "user": {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row?.id ?? null;
    }
    case "message": {
      const [row] = await db
        .select({ sender_id: messages.sender_id })
        .from(messages)
        .where(eq(messages.id, id))
        .limit(1);
      return row?.sender_id ?? null;
    }
    default:
      return null;
  }
}

async function targetExists(
  type: ReportTargetType,
  id: number
): Promise<boolean> {
  const ownerId = await getTargetOwnerId(type, id);
  return ownerId !== null;
}

async function deleteContent(
  type: ReportTargetType,
  id: number
): Promise<boolean> {
  switch (type) {
    case "post":
      await db.delete(posts).where(eq(posts.id, id));
      return true;
    case "comment":
      await db.delete(postComments).where(eq(postComments.id, id));
      return true;
    case "review":
      await db.delete(reviews).where(eq(reviews.id, id));
      return true;
    case "product":
      await db.delete(products).where(eq(products.id, id));
      return true;
    case "shop":
      await db.delete(shops).where(eq(shops.id, id));
      return true;
    case "message":
      await db
        .update(messages)
        .set({ deleted_at: new Date() })
        .where(eq(messages.id, id));
      return true;
    case "user":
      return false;
    default:
      return false;
  }
}

async function notifyUser(
  userId: number,
  title: string,
  content: string,
  link: string | null
) {
  try {
    await db.insert(notifications).values({
      user_id: userId,
      type: "moderation",
      title,
      content,
      link,
    });
  } catch (err) {
    console.error("❌ Erreur notification modération:", err);
  }
}

export async function createReport(
  reporterId: number,
  input: CreateReportInput
) {
  const exists = await targetExists(input.target_type, input.target_id);
  if (!exists) {
    throw new AppError("Le contenu signalé n'existe pas", 404);
  }

  const ownerId = await getTargetOwnerId(input.target_type, input.target_id);

  if (ownerId === reporterId) {
    throw new AppError("Tu ne peux pas signaler ton propre contenu", 400);
  }

  const [existing] = await db
    .select()
    .from(contentReports)
    .where(
      and(
        eq(contentReports.reporter_id, reporterId),
        eq(contentReports.target_type, input.target_type),
        eq(contentReports.target_id, input.target_id),
        eq(contentReports.status, "pending")
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError("Tu as déjà signalé ce contenu", 409);
  }

  const [created] = await db
    .insert(contentReports)
    .values({
      reporter_id: reporterId,
      target_type: input.target_type,
      target_id: input.target_id,
      reason: input.reason,
      description: input.description ?? null,
    })
    .returning();

  return created;
}

export async function listReports(query: ListReportsQuery) {
  const { status, target_type, limit, offset } = query;

  const rows = await db
    .select({
      id: contentReports.id,
      reporter_id: contentReports.reporter_id,
      target_type: contentReports.target_type,
      target_id: contentReports.target_id,
      reason: contentReports.reason,
      description: contentReports.description,
      status: contentReports.status,
      created_at: contentReports.created_at,
      resolved_at: contentReports.resolved_at,
      reporter_username: users.username,
      reporter_avatar_url: users.avatar_url,
    })
    .from(contentReports)
    .leftJoin(users, eq(users.id, contentReports.reporter_id))
    .where(
      and(
        status === "all" ? sql`true` : eq(contentReports.status, status),
        target_type === "all"
          ? sql`true`
          : eq(contentReports.target_type, target_type)
      )
    )
    .orderBy(desc(contentReports.created_at))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function getReportById(id: number) {
  const [row] = await db
    .select()
    .from(contentReports)
    .where(eq(contentReports.id, id))
    .limit(1);

  if (!row) throw new AppError("Signalement introuvable", 404);
  return row;
}

export async function resolveReport(
  id: number,
  adminId: number,
  adminNote: string | null,
  deleteContentFlag: boolean
) {
  const report = await getReportById(id);

  if (report.status !== "pending") {
    throw new AppError("Ce signalement a déjà été traité", 409);
  }

  let contentDeleted = false;
  if (deleteContentFlag) {
    contentDeleted = await deleteContent(
      report.target_type as ReportTargetType,
      report.target_id
    );
  }

  await db
    .update(contentReports)
    .set({
      status: "resolved",
      admin_id: adminId,
      admin_note: adminNote ?? null,
      content_deleted: contentDeleted ? 1 : 0,
      resolved_at: new Date(),
    })
    .where(eq(contentReports.id, id));

  await notifyUser(
    report.reporter_id,
    "Signalement traité",
    contentDeleted
      ? "Merci, ton signalement a été traité et le contenu a été supprimé."
      : "Merci, ton signalement a été traité.",
    null
  );

  return { success: true, content_deleted: contentDeleted };
}

export async function dismissReport(
  id: number,
  adminId: number,
  adminNote: string
) {
  const report = await getReportById(id);

  if (report.status !== "pending") {
    throw new AppError("Ce signalement a déjà été traité", 409);
  }

  await db
    .update(contentReports)
    .set({
      status: "dismissed",
      admin_id: adminId,
      admin_note: adminNote,
      resolved_at: new Date(),
    })
    .where(eq(contentReports.id, id));

  await notifyUser(
    report.reporter_id,
    "Signalement examiné",
    "Après examen, ton signalement n'a pas été retenu.",
    null
  );

  return { success: true };
}

export async function getReportsStats() {
  const rows = await db
    .select({
      status: contentReports.status,
      count: sql<number>`count(*)::int`,
    })
    .from(contentReports)
    .groupBy(contentReports.status);

  const byType = await db
    .select({
      target_type: contentReports.target_type,
      count: sql<number>`count(*)::int`,
    })
    .from(contentReports)
    .where(eq(contentReports.status, "pending"))
    .groupBy(contentReports.target_type);

  const stats = { pending: 0, resolved: 0, dismissed: 0, total: 0 };
  for (const r of rows) {
    if (r.status === "pending") stats.pending = r.count;
    if (r.status === "resolved") stats.resolved = r.count;
    if (r.status === "dismissed") stats.dismissed = r.count;
    stats.total += r.count;
  }

  return { stats, by_type: byType };
}
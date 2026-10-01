import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db";
import { kycRequests, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { verifySiret } from "./siret.service";
import type { CreateKycInput } from "./kyc.validation";

export async function getMyActiveKycRequest(userId: number) {
  const [row] = await db
    .select()
    .from(kycRequests)
    .where(
      and(eq(kycRequests.user_id, userId), eq(kycRequests.status, "pending"))
    )
    .limit(1);
  return row ?? null;
}

export async function getMyLastKycRequest(userId: number) {
  const [row] = await db
    .select()
    .from(kycRequests)
    .where(eq(kycRequests.user_id, userId))
    .orderBy(kycRequests.created_at)
    .limit(1);
  return row ?? null;
}

export async function createKycRequest(userId: number, input: CreateKycInput) {
  const existing = await getMyActiveKycRequest(userId);
  if (existing) {
    throw new AppError("Vous avez deja une demande en cours", 409);
  }

  const siretResult = await verifySiret(input.siret);
  if (!siretResult.valid) {
    throw new AppError(siretResult.error ?? "SIRET invalide", 400);
  }

  const [created] = await db
    .insert(kycRequests)
    .values({
      user_id: userId,
      status: "pending",
      type: input.type,
      siret: input.siret,
      siret_verified: 1,
      siret_data: JSON.stringify(siretResult.etablissement ?? {}),
      documents: JSON.stringify(input.documents),
    })
    .returning();

  await db
    .update(users)
    .set({ verification_status: "pending" })
    .where(eq(users.id, userId));

  return created;
}

export async function cancelMyKycRequest(userId: number) {
  const existing = await getMyActiveKycRequest(userId);
  if (!existing) throw new AppError("Aucune demande en cours a annuler", 404);

  await db.delete(kycRequests).where(eq(kycRequests.id, existing.id));
  await db
    .update(users)
    .set({ verification_status: "none" })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function listKycRequests(opts: {
  status: string;
  type: string;
  limit: number;
  offset: number;
}) {
  const rows = await db
    .select({
      id: kycRequests.id,
      user_id: kycRequests.user_id,
      status: kycRequests.status,
      type: kycRequests.type,
      siret: kycRequests.siret,
      siret_verified: kycRequests.siret_verified,
      created_at: kycRequests.created_at,
      reviewed_at: kycRequests.reviewed_at,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      avatar_url: users.avatar_url,
    })
    .from(kycRequests)
    .innerJoin(users, eq(users.id, kycRequests.user_id))
    .where(
      and(
        opts.status === "all" ? sql`true` : eq(kycRequests.status, opts.status),
        opts.type === "all" ? sql`true` : eq(kycRequests.type, opts.type)
      )
    )
    .orderBy(kycRequests.created_at)
    .limit(opts.limit)
    .offset(opts.offset);

  return rows;
}

export async function getKycRequestById(id: number) {
  const [row] = await db
    .select()
    .from(kycRequests)
    .where(eq(kycRequests.id, id))
    .limit(1);
  if (!row) throw new AppError("Demande KYC introuvable", 404);
  return row;
}

export async function approveKycRequest(id: number, adminId: number) {
  const request = await getKycRequestById(id);
  if (request.status !== "pending") {
    throw new AppError("Cette demande a deja ete traitee", 409);
  }

  await db
    .update(kycRequests)
    .set({ status: "approved", admin_id: adminId, reviewed_at: new Date() })
    .where(eq(kycRequests.id, id));

  await db
    .update(users)
    .set({ verification_status: "verified" })
    .where(eq(users.id, request.user_id));

  return { success: true, user_id: request.user_id, type: request.type };
}

export async function rejectKycRequest(
  id: number,
  adminId: number,
  reason: string
) {
  const request = await getKycRequestById(id);
  if (request.status !== "pending") {
    throw new AppError("Cette demande a deja ete traitee", 409);
  }

  await db
    .update(kycRequests)
    .set({
      status: "rejected",
      admin_id: adminId,
      rejection_reason: reason,
      reviewed_at: new Date(),
    })
    .where(eq(kycRequests.id, id));

  await db
    .update(users)
    .set({ verification_status: "rejected" })
    .where(eq(users.id, request.user_id));

  return { success: true, user_id: request.user_id };
}

export async function getKycStats() {
  const rows = await db
    .select({
      status: kycRequests.status,
      count: sql<number>`count(*)::int`,
    })
    .from(kycRequests)
    .groupBy(kycRequests.status);

  const stats = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const r of rows) {
    if (r.status === "pending") stats.pending = r.count;
    if (r.status === "approved") stats.approved = r.count;
    if (r.status === "rejected") stats.rejected = r.count;
    stats.total += r.count;
  }
  return stats;
}
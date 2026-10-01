import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import { userBadges } from "../../db/schema";
import { AppError } from "../../errors/AppError";
import type { BadgeType } from "../kyc/kyc.validation";

// ============================================================
// LECTURE
// ============================================================

export async function getUserBadges(userId: number): Promise<string[]> {
  const rows = await db
    .select({ badge: userBadges.badge })
    .from(userBadges)
    .where(
      and(eq(userBadges.user_id, userId), isNull(userBadges.revoked_at))
    );
  return rows.map((r) => r.badge);
}

/**
 * Batch : retourne les badges actifs pour plusieurs users (anti N+1).
 */
export async function getBadgesForUsers(
  userIds: number[]
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (userIds.length === 0) return result;

  const uniqueIds = Array.from(new Set(userIds));

  const rows = await db
    .select({ user_id: userBadges.user_id, badge: userBadges.badge })
    .from(userBadges)
    .where(
      and(
        inArray(userBadges.user_id, uniqueIds),
        isNull(userBadges.revoked_at)
      )
    );

  for (const r of rows) {
    const arr = result.get(r.user_id) ?? [];
    arr.push(r.badge);
    result.set(r.user_id, arr);
  }
  return result;
}

// ============================================================
// ECRITURE (ADMIN)
// ============================================================

export async function grantBadge(
  userId: number,
  badge: BadgeType,
  adminId: number
) {
  const existing = await db
    .select()
    .from(userBadges)
    .where(
      and(
        eq(userBadges.user_id, userId),
        eq(userBadges.badge, badge),
        isNull(userBadges.revoked_at)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new AppError("Ce badge est deja attribue a cet utilisateur", 409);
  }

  const [created] = await db
    .insert(userBadges)
    .values({ user_id: userId, badge, granted_by: adminId })
    .returning();

  return created;
}

export async function revokeBadge(
  userId: number,
  badge: BadgeType,
  _adminId: number
) {
  const [existing] = await db
    .select()
    .from(userBadges)
    .where(
      and(
        eq(userBadges.user_id, userId),
        eq(userBadges.badge, badge),
        isNull(userBadges.revoked_at)
      )
    )
    .limit(1);

  if (!existing) {
    throw new AppError("Ce badge n'est pas actif pour cet utilisateur", 404);
  }

  await db
    .update(userBadges)
    .set({ revoked_at: new Date() })
    .where(eq(userBadges.id, existing.id));

  return { success: true };
}
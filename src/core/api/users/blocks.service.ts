// ============================================================
// ANKU — Blocage / Restriction utilisateurs
// ============================================================
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "../../db";
import { userBlocks, users } from "../../db/schema";
import { AppError } from "../../errors/AppError";

const BLOCK = "block";
const RESTRICT = "restrict";

// ============================================================
// HELPERS PRIVÉS
// ============================================================

async function assertNotAdmin(targetId: number) {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (user?.role === "admin") {
    throw new AppError("Tu ne peux pas bloquer ni restreindre un administrateur ANKU", 403);
  }
}
async function assertUserExists(userId: number) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AppError("Utilisateur introuvable", 404);
}

async function assertNotSelf(userId: number, targetId: number) {
  if (userId === targetId) {
    throw new AppError("Tu ne peux pas faire ça sur toi-même", 400);
  }
}

async function findRow(
  blockerId: number,
  blockedId: number,
  type: "block" | "restrict"
) {
  const [row] = await db
    .select()
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blocker_id, blockerId),
        eq(userBlocks.blocked_id, blockedId),
        eq(userBlocks.type, type)
      )
    )
    .limit(1);
  return row ?? null;
}

// ============================================================
// BLOCAGE
// ============================================================

export async function blockUser(blockerId: number, blockedId: number) {
  await assertNotSelf(blockerId, blockedId);
  await assertUserExists(blockedId);
  await assertNotAdmin(blockedId);

  const existing = await findRow(blockerId, blockedId, BLOCK);
  if (existing) {
    throw new AppError("Tu bloques déjà cet utilisateur", 409);
  }

  // Si on bloque, on retire la restriction éventuelle (redondant)
  await db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blocker_id, blockerId),
        eq(userBlocks.blocked_id, blockedId),
        eq(userBlocks.type, RESTRICT)
      )
    );

  const [created] = await db
    .insert(userBlocks)
    .values({ blocker_id: blockerId, blocked_id: blockedId, type: BLOCK })
    .returning();

  return { success: true, block_id: created.id, type: BLOCK };
}

export async function unblockUser(blockerId: number, blockedId: number) {
  await assertNotSelf(blockerId, blockedId);

  const existing = await findRow(blockerId, blockedId, BLOCK);
  if (!existing) {
    throw new AppError("Tu ne bloques pas cet utilisateur", 404);
  }

  await db.delete(userBlocks).where(eq(userBlocks.id, existing.id));
  return { success: true };
}

// ============================================================
// RESTRICTION
// ============================================================

export async function restrictUser(blockerId: number, blockedId: number) {
  await assertNotSelf(blockerId, blockedId);
  await assertUserExists(blockedId);
  await assertNotAdmin(blockedId);

  const existing = await findRow(blockerId, blockedId, RESTRICT);
  if (existing) {
    throw new AppError("Tu restreins déjà cet utilisateur", 409);
  }

  const [created] = await db
    .insert(userBlocks)
    .values({ blocker_id: blockerId, blocked_id: blockedId, type: RESTRICT })
    .returning();

  return { success: true, restrict_id: created.id, type: RESTRICT };
}

export async function unrestrictUser(blockerId: number, blockedId: number) {
  await assertNotSelf(blockerId, blockedId);

  const existing = await findRow(blockerId, blockedId, RESTRICT);
  if (!existing) {
    throw new AppError("Tu ne restreins pas cet utilisateur", 404);
  }

  await db.delete(userBlocks).where(eq(userBlocks.id, existing.id));
  return { success: true };
}

// ============================================================
// LECTURE
// ============================================================

/**
 * Liste les utilisateurs bloqués par `userId`.
 */
export async function listBlocked(userId: number) {
  const rows = await db
    .select({
      id: userBlocks.id,
      created_at: userBlocks.created_at,
      user_id: users.id,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      avatar_url: users.avatar_url,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blocked_id))
    .where(
      and(
        eq(userBlocks.blocker_id, userId),
        eq(userBlocks.type, BLOCK)
      )
    )
    .orderBy(desc(userBlocks.created_at));

  return rows;
}

/**
 * Liste les utilisateurs restreints par `userId`.
 */
export async function listRestricted(userId: number) {
  const rows = await db
    .select({
      id: userBlocks.id,
      created_at: userBlocks.created_at,
      user_id: users.id,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      avatar_url: users.avatar_url,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blocked_id))
    .where(
      and(
        eq(userBlocks.blocker_id, userId),
        eq(userBlocks.type, RESTRICT)
      )
    )
    .orderBy(desc(userBlocks.created_at));

  return rows;
}

// ============================================================
// CHECKS (utilisés dans les autres services)
// ============================================================

/** L'utilisateur A a-t-il bloqué B ? */
export async function isBlocked(
  blockerId: number,
  targetId: number
): Promise<boolean> {
  const row = await findRow(blockerId, targetId, BLOCK);
  return !!row;
}

/** L'utilisateur A a-t-il restreint B ? */
export async function isRestricted(
  blockerId: number,
  targetId: number
): Promise<boolean> {
  const row = await findRow(blockerId, targetId, RESTRICT);
  return !!row;
}

/**
 * Renvoie tous les IDs bloqués PAR `userId`.
 * Utilisé pour filtrer le feed / posts / commentaires.
 */
export async function getBlockedIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: userBlocks.blocked_id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blocker_id, userId),
        eq(userBlocks.type, BLOCK)
      )
    );
  return rows.map((r) => r.id);
}

/**
 * Renvoie tous les IDs restreints PAR `userId`.
 */
export async function getRestrictedIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: userBlocks.blocked_id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blocker_id, userId),
        eq(userBlocks.type, RESTRICT)
      )
    );
  return rows.map((r) => r.id);
}

/**
 * Renvoie tous les IDs qui ONT bloqué `userId` (bidirectionnel).
 * Utilisé pour interdire l'envoi de message et le suivi.
 */
export async function getBlockersOf(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: userBlocks.blocker_id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blocked_id, userId),
        eq(userBlocks.type, BLOCK)
      )
    );
  return rows.map((r) => r.id);
}

/**
 * Renvoie tous les IDs qui ONT restreint `userId`.
 */
export async function getRestrictorsOf(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: userBlocks.blocker_id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blocked_id, userId),
        eq(userBlocks.type, RESTRICT)
      )
    );
  return rows.map((r) => r.id);
}

/**
 * Fusion pratique : tous les IDs à masquer pour `userId` dans le feed.
 * = les utilisateurs qu'il bloque + ceux qui le bloquent (bidirectionnel).
 */
export async function getHiddenUserIds(userId: number): Promise<number[]> {
  const [blocked, blockers] = await Promise.all([
    getBlockedIds(userId),
    getBlockersOf(userId),
  ]);
  return Array.from(new Set([...blocked, ...blockers]));
}

/**
 * Peut-on interagir avec cette cible ?
 * @throws AppError si bloqué ou restreint
 */
export async function assertCanInteract(
  actorId: number,
  targetId: number,
  action = "interagir avec"
): Promise<void> {
  if (actorId === targetId) return;

  const [iBlocked, iRestricted, theyBlocked] = await Promise.all([
    isBlocked(actorId, targetId),
    isRestricted(actorId, targetId),
    isBlocked(targetId, actorId),
  ]);

  if (iBlocked) {
    throw new AppError(`Tu ne peux pas ${action} cet utilisateur (bloqué)`, 403);
  }
  if (iRestricted) {
    throw new AppError(
      `Tu ne peux pas ${action} cet utilisateur (restreint)`,
      403
    );
  }
  if (theyBlocked) {
    throw new AppError(
      `Tu ne peux pas ${action} cet utilisateur (tu es bloqué)`,
      403
    );
  }
}
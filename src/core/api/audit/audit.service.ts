import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, users } from "../../db/schema";
import type { ListAuditLogsQuery } from "./audit.validation";

// ============================================================
// LECTURE (admin)
// ============================================================

export async function listAuditLogs(query: ListAuditLogsQuery) {
  const {
    admin_id,
    action,
    target_type,
    target_id,
    from,
    to,
    limit,
    offset,
  } = query;

  const conditions: any[] = [];

  if (admin_id) conditions.push(eq(auditLogs.admin_id, admin_id));
  if (action !== "all") conditions.push(eq(auditLogs.action, action));
  if (target_type !== "all")
    conditions.push(eq(auditLogs.target_type, target_type));
  if (target_id) conditions.push(eq(auditLogs.target_id, target_id));
  if (from) conditions.push(gte(auditLogs.created_at, from));
  if (to) conditions.push(lte(auditLogs.created_at, to));

  const rows = await db
    .select({
      id: auditLogs.id,
      admin_id: auditLogs.admin_id,
      action: auditLogs.action,
      target_type: auditLogs.target_type,
      target_id: auditLogs.target_id,
      description: auditLogs.description,
      metadata: auditLogs.metadata,
      ip_address: auditLogs.ip_address,
      user_agent: auditLogs.user_agent,
      created_at: auditLogs.created_at,
      admin_username: users.username,
      admin_first_name: users.first_name,
      admin_last_name: users.last_name,
      admin_avatar_url: users.avatar_url,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.admin_id))
    .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
    .orderBy(desc(auditLogs.created_at))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    admin: {
      id: r.admin_id,
      username: r.admin_username,
      first_name: r.admin_first_name,
      last_name: r.admin_last_name,
      avatar_url: r.admin_avatar_url,
    },
  }));
}

// ============================================================
// STATS (dashboard admin)
// ============================================================

export async function getAuditStats() {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs);

  const byAction = await db
    .select({
      action: auditLogs.action,
      count: sql<number>`count(*)::int`,
    })
    .from(auditLogs)
    .groupBy(auditLogs.action)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const [last24hRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(sql`${auditLogs.created_at} >= now() - interval '24 hours'`);

  const [last7dRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(sql`${auditLogs.created_at} >= now() - interval '7 days'`);

  const byAdmin = await db
    .select({
      admin_id: auditLogs.admin_id,
      count: sql<number>`count(*)::int`,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.admin_id))
    .groupBy(
      auditLogs.admin_id,
      users.username,
      users.first_name,
      users.last_name
    )
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    total: totalRow?.count ?? 0,
    last_24h: last24hRow?.count ?? 0,
    last_7d: last7dRow?.count ?? 0,
    by_action: byAction,
    by_admin: byAdmin,
  };
}